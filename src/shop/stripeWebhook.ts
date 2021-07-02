import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import Stripe  from 'stripe'
import { Product, Order, Currency } from '../dbTypes'
import { productInfoBySku, qSnapToArray, sendMail } from './helpers'

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers['stripe-signature'] as string

  const stripe = new Stripe(req.body.livemode ? functions.config().stripe.key : functions.config().stripe.testkey, { apiVersion: '2020-03-02' })
  const endpointSecret = req.body.livemode ? functions.config().stripe.sign : functions.config().stripe.testsign

  let event
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret)
  } catch (err) {
    functions.logger.error(err)
    res.status(400).end()
    return
  }

  if (!['checkout.session.completed', 'checkout_beta.session_succeeded'].includes(event.type)) {
    res.status(400).end()
    return
  }

  functions.logger.debug('stripeEvent', event)

  const eventData = event.data.object as Stripe.Checkout.Session

  const updates: Partial<Order> = {}

  try {
    if (eventData.client_reference_id) {
      const orderDSnapPromise = admin.firestore().collection('orders').doc(eventData.client_reference_id).get()
      const productsPromise = admin.firestore().collection('products').get().then(qSnap => qSnapToArray<Product>(qSnap))

      updates.livemode = event.livemode
      updates.paymentIntent = eventData.payment_intent
      updates.paid = true
      updates.paidItems = eventData.display_items
      updates.received = admin.firestore.Timestamp.now()

      const orderDsnap = await orderDSnapPromise
      const order: Order = {
        id: orderDsnap.id,
        ...orderDsnap.data() as Omit<Order, 'id'>
      }

      const products = await productsPromise

      const resolvedOrder = resolveOrder(order, products)
      if (!resolvedOrder) {
        throw new Error('Could not resolve order')
      }

      await sendMail(
        order.customerDetails.email,
        "Order Placed with the Tricktionary",
        1570109,
        {
          date: updates.received.toDate().toISOString(),
          id: order.id,
          livemode: event.livemode,
          name: order.customerDetails.name ?? '',
          company: order.customerDetails.company ?? '',
          vatnumber: order.customerDetails.vatnumber ?? '',
          address1: order.customerDetails.address1 ?? '',
          address2: order.customerDetails.address2 ?? '',
          state: order.customerDetails.state ?? '',
          postalCode: order.customerDetails.postalCode ?? '',
          city: order.customerDetails.city ?? '',
          countryCode: order.customerDetails.countryCode ?? '',
          ...resolvedOrder
        }
      )

      updates.receiptSent = admin.firestore.Timestamp.now()

      await orderDsnap.ref.update(updates)

      res.status(200).end()
      return
    }
  } catch (err) {
    functions.logger.error(err)
    res.status(500).end()
    return
  }
})

function resolveOrder (order: Order, products: Product[]) {
  const productRows = []

  if (order.paid && order.paidItems) {
    for (const productRow of order.paidItems) {
      const resolvedProductInfo = productInfoBySku(typeof productRow.sku === 'string' ? productRow.sku : (productRow.sku?.id ?? ''), products)
      if (!resolvedProductInfo) return

      productRows.push({
        qty: productRow.quantity,
        name: resolvedProductInfo.name,
        vatTotal: Math.round((productRow.quantity ?? 1) * (productRow.amount ?? 0) * (1 - (1 / (1 + resolvedProductInfo.vat)))),
        vatPercentage: resolvedProductInfo.vat,
        total: (productRow.quantity ?? 1) * (productRow.amount ?? 0),
        currency: resolvedProductInfo.currency,
        unit: resolvedProductInfo.unit,
        unitPrice: resolvedProductInfo.price
      })
    }
  } else {
    for (const productRow of order.requestedItems) {
      const resolvedProductInfo = productInfoBySku(typeof productRow.sku === 'string' ? productRow.sku : (productRow.sku as Stripe.Sku).id, products)
      if (!resolvedProductInfo) return

      productRows.push({
        qty: productRow.quantity,
        name: resolvedProductInfo.name,
        vatTotal: Math.round(productRow.quantity * resolvedProductInfo.price * (1 - (1 / (1 + resolvedProductInfo.vat)))),
        vatPercentage: resolvedProductInfo.vat,
        total: productRow.quantity * resolvedProductInfo.price,
        currency: resolvedProductInfo.currency,
        unit: resolvedProductInfo.unit,
        unitPrice: resolvedProductInfo.price
      })
    }
  }

  return {
    productRows,
    ...productRows.reduce((acc, curr) => {
      acc.subtotal += curr.total - curr.vatTotal
      acc.vatTotal += curr.vatTotal
      acc.total += curr.total
      acc.currency = curr.currency
      return acc
    }, { subtotal: 0, vatTotal: 0, total: 0, currency: '' as Currency | undefined })
  }
}
