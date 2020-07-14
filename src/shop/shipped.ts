import * as functions from 'firebase-functions'
import { firestore } from 'firebase-admin'
import { Order } from '../dbTypes'
import { sendMail } from './helpers'

export const shipped = functions.https.onCall(async (data, ctx) => {
  if (!ctx.auth) return { error: 'Insufficient permissions' }

  const orderRef = firestore().collection('orders').doc(data.id)
  const userSnap = await firestore().collection('users').doc(ctx.auth.uid).get()

  if (!userSnap.get('admin')) return { error: 'Insufficient permissions' }

  const orderSnap = await orderRef.get()
  const order = orderSnap.data() as Omit<Order, 'id'>

  await sendMail(order.customerDetails.email, 'Your Order from the Tricktionary has been Shipped', 1569037, {
    tracking: data.tracking ?? '',
    name: order.customerDetails.name ?? '',
    livemode: order.livemode ?? false
  })

  const updates = {
    shippingEmailSent: firestore.Timestamp.now(),
    shipped: firestore.Timestamp.now(),
    tracking: data.tracking
  }

  await orderRef.update(updates)

  return updates
})
