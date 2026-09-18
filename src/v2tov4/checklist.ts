import * as functions from 'firebase-functions/v1'
import { logger } from 'firebase-functions/logger'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

interface FSTrickCompletion {
  userId: string
  trickId: string
  createdAt: Timestamp
}

export const checklistWrite = functions.database.ref('/checklist/{userId}/{id0}/{id1}')
  .onWrite(async (change, ctx) => {
    const completed: boolean | null = change.after.val()
    const tricksSnap = await getFirestore().collection('tricks')
      .where('oldId', '==', `${ctx.params.id0}/${ctx.params.id1}`)
      .get()

    if (tricksSnap.empty) {
      logger.warn('Completed trick not found in target', ctx.params)
      return false
    }

    const trickId = tricksSnap.docs[0].id

    const qSnap = await getFirestore().collection('trick-completions')
      .where('userId', '==', ctx.params.userId)
      .where('trickId', '==', trickId)
      .get()

    if (completed && qSnap.empty) {
      logger.info('Adding trick completion to target')
      const payload: FSTrickCompletion = {
        userId: ctx.params.userId,
        trickId,
        createdAt: Timestamp.now()
      }
      logger.debug(payload)
      return await getFirestore().collection('trick-completions').add(payload)
    } else if (!completed && !qSnap.empty) {
      logger.info('Removing trick completions from target')
      const batch = getFirestore().batch()

      for (const dSnap of qSnap.docs) {
        batch.delete(dSnap.ref)
      }

      return await batch.commit()
    } else {
      logger.info('Trick completion already added or deleted in target')
      return true
    }
  })
