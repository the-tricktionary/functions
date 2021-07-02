import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { verifyVat } from './helpers'

export const processOrder = functions.firestore.document('/orders/{order}').onCreate(async (dSnap, ctx) => {
  const data = dSnap.data()

  if (!data) return

  const changes: { [prop: string]: any } = {}

  if (!data.vatVerified) {
    if (data.customerDetails.vatnumber) {
      const vatResult = await verifyVat(data.customerDetails.vatnumber)

      functions.logger.debug('verifyVat', vatResult)
      changes['customerDetails.vatValid'] = vatResult.valid
      changes['customerDetails.vatCountryCode'] = vatResult.countryCode
      changes['vatVerified'] = new Date()
    } else {
      changes['customerDetails.vatValid'] = false
      changes['customerDetails.vatCountryCode'] = ''
      changes['vatVerified'] = new Date()
    }
  }

  if (!data.couponVerified) {
    const couponSnap = await admin.firestore().collection('shopSettings').doc('coupons').get()

    changes['couponValid'] = data.coupon ? !!couponSnap.get(data.coupon) : false
    changes['couponVerified'] = new Date()
  }

  // if (!data.sanitized) {

  // }

  return dSnap.ref.update(changes)
})
