import { firestore } from "firebase-admin";
import Stripe from "stripe";

export interface Product {
  id: string
  image: string
  name: string
  qty: number
  tollCode?: string
  unit?: string
  vat: number

  skus: Skus
  'test-skus': Skus
  prices: {
    [C in Currency]: number
  }
}

interface Skus {
  'EUR': string
  'EUR-VAT': string
  'SEK': string
  'SEK-VAT': string
  'USD': string
  'USD-VAT': string
}

export interface Order {
  id: string

  received?: firestore.Timestamp | Date

  coupon?: string
  couponValid?: boolean
  couponVerified?: firestore.Timestamp | Date

  currency?: string

  livemode?: boolean
  paid?: boolean
  paymentIntent?: string | Stripe.PaymentIntent | null

  sanitized?: firestore.Timestamp | Date
  vatVerified?: firestore.Timestamp | Date
  receiptSent?: firestore.Timestamp | Date

  customerDetails: {
    company: string
    name: string
    address1: string
    address2: string
    city: string
    state: string
    postalCode: string
    countryCode: string
    vatCountryCode: string
    vatValid?: boolean
    vatnumber?: string
    email: string
    phone: string
  }

  paidItems: Stripe.Checkout.Session.DisplayItem[]
  requestedItems: Array<{
    quantity: number
    sku: string
  }>
}

export type Currency = 'SEK' | 'USD' | 'EUR'
