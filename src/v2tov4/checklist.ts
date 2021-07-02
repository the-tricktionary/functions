import * as functions from 'firebase-functions'
import { firestore } from 'firebase-admin'
import { Timestamp } from '@google-cloud/firestore'

interface FSTrickCompletion {
  userId: string
  trickId: string
  createdAt: Timestamp
}

export const createChecklistEntry = functions.database.ref('/checklist/{userId}/{id0}/{id1}')
  .onWrite(async (change, ctx) => {
    const completed: boolean | null = change.after.val()
    const tricksSnap = await firestore().collection('tricks')
      .where('oldId', '==', `${ctx.params.id0}/${ctx.params.id1}`)
      .get()

    if (tricksSnap.empty) return false

    const trickId = tricksSnap.docs[0].id

    const qSnap = await firestore().collection('trick-completions')
      .where('userId', '==', ctx.params.userId)
      .where('trickId', '==', trickId)
      .get()

    if (completed && qSnap.empty) {
      const payload: FSTrickCompletion = {
        userId: ctx.params.userId,
        trickId: trickId,
        createdAt: Timestamp.now()
      }
      return firestore().collection('trick-completions').add(payload)
    } else if (!completed && !qSnap.empty) {
      const batch = firestore().batch()

      for (const dSnap of qSnap.docs) {
        batch.delete(dSnap.ref)
      }

      return batch.commit()
    } else return true
  })
