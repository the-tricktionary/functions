import * as functions from 'firebase-functions'
import { firestore } from 'firebase-admin'

export const verifyCoupon = functions.https.onCall(async (data, ctx) => {
  const coupons = await firestore().collection('shopSettings').doc('coupons').get().then(dSnap => dSnap.data())

  if (coupons?.[data.code]) {
    return { valid: true }
  } else {
    return { valid: false }
  }
})
