import * as functions from 'firebase-functions/v1'
import { getFirestore } from 'firebase-admin/firestore'

function disciplineToSlug (discipline: string) {
  switch (discipline) {
    case 'SingleRope':
      return 'sr'
    case 'DoubleDutch':
      return 'dd'
    case 'Wheel':
      return 'wh'
    default:
      throw new Error(`Unknown discipline: ${discipline}`)
  }
}

export const sitemapGet = functions.https.onRequest(async (req, res) => {
  const qSnap = await getFirestore().collection('tricks').get()

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>

<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${qSnap.docs.map(dSnap => `  <url>
    <loc>https://the-tricktionary.com/trick/${disciplineToSlug(dSnap.get('discipline') as string)}/${dSnap.get('slug')}</loc>
    <changefreq>yearly</changefreq>
  </url>`).join('\n')}
</urlset>
`

  res.set('content-type', 'application/xml')

  res.status(200).send(sitemap)
})
