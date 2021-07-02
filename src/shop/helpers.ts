import { Product, Currency } from "../dbTypes"
import { firestore } from "firebase-admin"
import { config, logger } from 'firebase-functions'
import fetch from 'node-fetch'
import * as Mailjet from 'node-mailjet'

const mailjet = Mailjet.connect(config().mailjet.key, config().mailjet.secret, { version: 'v3.1' })

export function productInfoBySku (sku: string, products: Product[]) {
  const product = products.find(searchProd => {
    const skus = [...Object.values(searchProd.skus), ...Object.values(searchProd['test-skus'])]
    return skus.includes(sku)
  })

  if (!product) return

  const skuEntries = [...Object.entries(product.skus), ...Object.entries(product['test-skus'])]
  const skuName = skuEntries.find(entry => entry[1] === sku)?.[0]
  const [currency, withVat] = (skuName?.split('-') ?? []) as [Currency, 'VAT' | undefined]

  return {
    id: product.id,
    name: product.name,
    currency,
    vat: !!withVat ? product.vat : 0,
    unit: product.unit,
    price: product.prices[currency]
  }
}

export function qSnapToArray<T> (qSnap: firestore.QuerySnapshot) {
  const arr: T[] = []
  qSnap.forEach(dSnap => {
    arr.push({
      id: dSnap.id,
      ...dSnap.data() as Omit<T, 'id'>
    } as unknown as T)
  })
  return arr
}

export function verifyVat (vatNumber: string): Promise<{ valid: boolean; countryCode: string; }> {
  return fetch(`http://www.apilayer.net/api/validate?access_key=${config().apilayer.key}&vat_number=${vatNumber}`)
    .then(res => {
      if (!res.ok) throw Error(res.statusText);
      return res;
    })
    .then(res => res.json())
    .then(body => ({ valid: body.valid, countryCode: body.countryCode }))
    .catch(err => {
      logger.error(err)
      return { valid: false, countryCode: '' }
    })
}

export function sendMail (to: string, subject: string, templateID: number, variables?: any) {
  logger.info('Sending Email', { to, subject, templateID, variables })
  return mailjet.post('send')
    .request({
      Messages: [
        {
          From: {
            Email: "shop@the-tricktionary.com",
            Name: "the Tricktionary"
          },
          To: [
            {
              Email: to,
              Name: variables?.customerDetails?.name ?? variables.name ?? ''
            }
          ],
          Bcc: [
            {
              Email: "shop@the-tricktionary.com",
              Name: "the Tricktionary"
            }
          ],
          // Headers: {
          //   'Reply-to': 'shop@the-tricktionary.com'
          // },
          TemplateErrorReporting: {
            Email: "svante.b37@gmail.com",
            Name: "Svante Bengtson"
          },
          TemplateID: templateID,
          TemplateLanguage: true,
          Subject: subject,
          Variables: variables
        }
      ]
    })
}
