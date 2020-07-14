import * as functions from 'firebase-functions'
import { Order } from '../dbTypes'
import { verifyVat } from './helpers'

export const verifyBusiness = functions.https.onCall(async (data: Order, ctx) => {
  if (!data?.customerDetails?.vatnumber) return { vat_valid: false, vatCountryCode: '' }

  const { valid, countryCode } = await verifyVat(data.customerDetails.vatnumber)

  return { valid, vatCountryCode: countryCode }
})
