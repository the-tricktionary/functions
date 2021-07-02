import * as functions from 'firebase-functions'
import { firestore } from 'firebase-admin'

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
  const qSnap = await firestore().collection('tricks').get()

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${qSnap.docs.map(dSnap => `  <url>
    <loc>https://the-tricktionary.com/trick/${disciplineToSlug(dSnap.get('discipline'))}/${dSnap.get('slug')}</loc>
    <lastmod>${dSnap.updateTime.toDate().toString()}</lastmod>
    <changefreq>yearly</changefreq>
  </url>`).join('\n')}
</urlset>`

  res.status(200).send(sitemap)
})
