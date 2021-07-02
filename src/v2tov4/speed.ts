import * as functions from 'firebase-functions'
import { firestore } from 'firebase-admin'
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
  eventDefinitionId: string

  // compat keys
  graphData?: number[]
  rtdKey?: string
}

interface FSEventDefinition {
  name: string
  totalDuration: number
  abbr?: string
  lookupCode?: string
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

    let eventDefinitionId: string
    let qSnap

    // yes this is verbose but ugh
    if (!data.event) {
      functions.logger.info('Speed Score has no event specified')
      qSnap = await firestore().collection('event-definitions')
        .where('name', '==', 'Unknown')
        .where('totalDuration', '==', data.time)
        .get()

      if (qSnap.empty) {
        functions.logger.debug(`Creating unkown event definition for duration ${data.time}`)
        const def: FSEventDefinition = {
          name: 'Unknown',
          totalDuration: data.time
        }
        const dSnap = await firestore().collection('event-definitions').add(def)
        eventDefinitionId = dSnap.id
      } else {
        eventDefinitionId = qSnap.docs[0].id
        functions.logger.debug(`Using existing unkown event definition for duration ${data.time}`)
      }
    } else {
      functions.logger.info('Speed Score has an event specified')
      qSnap = await firestore().collection('event-definitions')
        .where('abbr', '==', data.event)
        .where('totalDuration', '==', data.time)
        .get()

      if (qSnap.empty) {
        functions.logger.debug(`Creating event definition for ${data.event} with duration ${data.time}`)
        const def: FSEventDefinition = {
          name: data.event,
          totalDuration: data.time,
          abbr: data.event
        }
        const dSnap = await firestore().collection('event-definitions').add(def)
        eventDefinitionId = dSnap.id
      } else {
        eventDefinitionId = qSnap.docs[0].id
        functions.logger.debug(`Using existing event definition for ${data.event} with duration ${data.time}`)
      }
    }

    functions.logger.debug({ eventDefinitionId })

    const reformatted: FSSimpleSpeedResult = {
      ...(data.name ? { name: data.name } : {}),
      userId: ctx.params.userId,
      createdAt: Timestamp.fromMillis(parseInt(ctx.params.createdAt, 10) * 1000),

      count: data.score,
      eventDefinitionId,

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
