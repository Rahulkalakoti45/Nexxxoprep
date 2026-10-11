import test from 'node:test'
import assert from 'node:assert/strict'
import { measureConversationSeconds } from './conversation-duration.js'

const prismaWith = (min: Date | null, max: Date | null) =>
  ({
    transcript: {
      aggregate: async () => ({ _min: { createdAt: min }, _max: { createdAt: max } }),
    },
  }) as never

test('duration is the span from the first to the last transcript line', async () => {
  const first = new Date('2026-10-11T03:24:01.000Z')
  const last = new Date('2026-10-11T03:24:29.400Z')
  assert.equal(await measureConversationSeconds(prismaWith(first, last), 's1'), 28)
})

test('a session that existed for hours still reports only the conversation', async () => {
  // Session created yesterday; the conversation itself took 27 seconds.
  const first = new Date('2026-10-11T03:24:02.000Z')
  const last = new Date('2026-10-11T03:24:29.000Z')
  assert.equal(await measureConversationSeconds(prismaWith(first, last), 's1'), 27)
})

test('a single line or no transcript at all is zero, never negative or NaN', async () => {
  const at = new Date('2026-10-11T03:24:01.000Z')
  assert.equal(await measureConversationSeconds(prismaWith(at, at), 's1'), 0)
  assert.equal(await measureConversationSeconds(prismaWith(null, null), 's1'), 0)
  assert.equal(await measureConversationSeconds(prismaWith(new Date('2026-10-11T03:25:00Z'), new Date('2026-10-11T03:24:00Z')), 's1'), 0)
})

test('it asks only for this session\'s transcripts', async () => {
  let seen: unknown
  const prisma = {
    transcript: {
      aggregate: async (args: unknown) => {
        seen = args
        return { _min: { createdAt: null }, _max: { createdAt: null } }
      },
    },
  } as never
  await measureConversationSeconds(prisma, 'session-42')
  assert.deepEqual((seen as { where: unknown }).where, { sessionId: 'session-42' })
})
