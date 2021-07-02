import * as functions from 'firebase-functions'
import { firestore } from 'firebase-admin'
import { Order, Product } from '../dbTypes'
import { productInfoBySku, qSnapToArray } from './helpers'

export const updateStock = functions.firestore.document('/orders/{order}').onUpdate(async ({ before, after }, ctx) => {
  // if the update meant the document became paid we proceed
  if (!(!before.get('paid') && after.get('paid'))) return

  const paidItems: Order['paidItems'] = after.get('paidItems')
  const livemode: boolean = after.get('livemode')

  if (!paidItems || !livemode) return

  const batch = firestore().batch()
  const productsRef = firestore().collection('products')
  const products = await productsRef.get().then(qSnap => qSnapToArray<Product>(qSnap))

  for (const paidItem of paidItems) {
    const product = productInfoBySku(typeof paidItem.sku === 'string' ? paidItem.sku : (paidItem.sku?.id ?? ''), products)
    if (!product) continue
    const productRef = productsRef.doc(product.id)
    batch.update(productRef, { qty: firestore.FieldValue.increment(-(paidItem.quantity ?? 0)) })
  }

  return batch.commit()
})
