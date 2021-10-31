import * as functions from 'firebase-functions'
import { firestore, database } from 'firebase-admin'
import { Timestamp } from '@google-cloud/firestore'

interface RTDSpeedResult {
  avgJumps: number
  jumpsLost: number
  maxJumps: number
  misses: number
  noMissScore: number
  score: number
  graphData: number[]

  event: string
  time: number
  name?: string
}

interface FSSimpleSpeedResult {
  name?: string
  userId: string
  createdAt: Timestamp

  count: number
  eventDefinition: {
    name: string
    totalDuration: number
  }

  // compat keys
  graphData?: number[]
  rtdKey?: string
}

export const speedCreated = functions.database.ref('/speed/scores/{userId}/{createdAt}')
  .onCreate(async (snap, ctx) => {
    const data: RTDSpeedResult = snap.val()

    functions.logger.info('input', data)

    {
      const qSnap = await firestore().collection('speed-results')
        .where('userId', '==', ctx.params.userId)
        .where('rtdKey', '==', ctx.params.createdAt)
        .get()

      if (!qSnap.empty) {
        functions.logger.info('Speed score already processed')
        return true
      }
    }

    const reformatted: FSSimpleSpeedResult = {
      ...(data.name ? { name: data.name } : {}),
      userId: ctx.params.userId,
      createdAt: Timestamp.fromMillis(parseInt(ctx.params.createdAt, 10) * 1000),

      count: data.score,
      eventDefinition: {
        name: data.event ?? 'Unknown Event',
        totalDuration: data.time
      },

      graphData: data.graphData,
      rtdKey: ctx.params.createdAt
    }

    functions.logger.info('result', reformatted)

    return firestore().collection('speed-results').add(reformatted)
  })

export const speedUpdated = functions.database.ref('/speed/scores/{userId}/{createdAt}')
  .onUpdate(async (change, ctx) => {
    const qSnap = await firestore().collection('speed-results')
      .where('userId', '==', ctx.params.userId)
      .where('rtdKey', '==', ctx.params.createdAt)
      .get()

    if (!qSnap.size) {
      functions.logger.warn('No target speed scores to update', ctx.params)
      return true
    }

    const batch = firestore().batch()

    for (const dSnap of qSnap.docs) {
      batch.update(dSnap.ref, { name: change.after.val().name })
    }

    return batch.commit()
  })

export const speedDeleted = functions.database.ref('/speed/scores/{userId}/{createdAt}')
  .onDelete(async (snap, ctx) => {
    const qSnap = await firestore().collection('speed-results')
      .where('userId', '==', ctx.params.userId)
      .where('rtdKey', '==', ctx.params.createdAt)
      .get()

    if (!qSnap.size) {
      functions.logger.info('No target speed scores to delete', ctx.params)
      return true
    }

    const batch = firestore().batch()

    for (const dSnap of qSnap.docs) {
      batch.delete(dSnap.ref)
    }

    return batch.commit()
  })

export const v4SpeedDeleted = functions.firestore.document('speed-results/{docId}')
  .onDelete(async (dSnap, ctx) => {
    const data = dSnap.data() as FSSimpleSpeedResult

    // we only need to process entries that exist in the old database
    if (data.rtdKey == null) return

    // remove it from the old DB too so it doesn't come back
    await database().ref(`/speed/scores/${data.userId}/${data.rtdKey}`).remove()
  })
