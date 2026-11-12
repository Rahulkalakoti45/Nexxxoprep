import test from 'node:test'
import assert from 'node:assert/strict'
import { CodingAttemptService, toAttemptData, toAttemptRecord, type CodingAttemptInput } from './coding-attempt.service.js'

function attempt(overrides: Partial<CodingAttemptInput> = {}): CodingAttemptInput {
  return {
    id: 'two-sum-1793976027442',
    problemId: 'two-sum',
    problemTitle: 'Two Sum',
    difficulty: 'Easy',
    language: 'javascript',
    code: 'function twoSum() {}',
    messages: [{ role: 'candidate', content: 'O(n) time.' }],
    finalRun: { passed: 6, total: 6, hiddenPassed: 3, hiddenTotal: 3, results: [] },
    evaluation: { overall: 100, verdict: 'strong', generatedBy: 'local' },
    hintsUsed: 0,
    durationSeconds: 61.4,
    finishedAt: '2026-11-06T10:00:00.000Z',
    ...overrides,
  }
}

/** In-memory stand-in for the two Prisma tables the service touches. */
function fakePrisma(userIds: string[]) {
  const rows = new Map<string, Record<string, unknown>>()
  const key = (userId: string, clientAttemptId: string) => `${userId}/${clientAttemptId}`
  return {
    rows,
    user: { findUnique: async ({ where }: { where: { id: string } }) => (userIds.includes(where.id) ? { id: where.id } : null) },
    codingAttempt: {
      upsert: async ({ where, create, update }: { where: { userId_clientAttemptId: { userId: string; clientAttemptId: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const k = key(where.userId_clientAttemptId.userId, where.userId_clientAttemptId.clientAttemptId)
        const existing = rows.get(k)
        const row = existing ? { ...existing, ...update, updatedAt: new Date() } : { ...create, id: `row-${rows.size + 1}`, createdAt: new Date(), updatedAt: new Date() }
        rows.set(k, row)
        return row
      },
      findUnique: async ({ where }: { where: { userId_clientAttemptId: { userId: string; clientAttemptId: string } } }) =>
        rows.get(key(where.userId_clientAttemptId.userId, where.userId_clientAttemptId.clientAttemptId)) ?? null,
      findMany: async ({ where }: { where: { userId: string } }) =>
        [...rows.values()].filter((r) => r.userId === where.userId).sort((a, b) => (b.finishedAt as Date).getTime() - (a.finishedAt as Date).getTime()),
    },
  }
}

test('toAttemptData clamps the headline numbers so they always make sense', () => {
  const data = toAttemptData(attempt({ finalRun: { passed: 9, total: 6 }, evaluation: { overall: 140 }, hintsUsed: 99, durationSeconds: 61.4 }))
  assert.equal(data.testsPassed, 6, 'cannot pass more tests than exist')
  assert.equal(data.overallScore, 100)
  assert.equal(data.hintsUsed, 10)
  assert.equal(data.durationSeconds, 61)
  assert.equal(data.clientAttemptId, 'two-sum-1793976027442')
  assert.ok(data.finishedAt instanceof Date)
})

test('a stored attempt reads back in the browser shape, keyed by its own id', () => {
  const data = toAttemptData(attempt())
  const record = toAttemptRecord({ ...data, updatedAt: new Date('2026-11-06T10:01:00.000Z') })
  assert.equal(record.id, 'two-sum-1793976027442')
  assert.equal(record.languageLabel, 'JavaScript')
  assert.equal(record.finishedAt, '2026-11-06T10:00:00.000Z')
  assert.equal(record.syncedAt, '2026-11-06T10:01:00.000Z')
  assert.deepEqual(record.messages, [{ role: 'candidate', content: 'O(n) time.' }])
})

test('saving the same attempt twice updates it instead of duplicating', async () => {
  const prisma = fakePrisma(['u1'])
  const service = new CodingAttemptService(prisma as never)
  await service.save('u1', attempt())
  await service.save('u1', attempt({ evaluation: { overall: 88, verdict: 'okay', generatedBy: 'gemini' } }))
  assert.equal(prisma.rows.size, 1)
  const listed = await service.list('u1')
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.evaluation.overall, 88)
})

test('attempts are per user, and unknown users or attempts are not found', async () => {
  const prisma = fakePrisma(['u1', 'u2'])
  const service = new CodingAttemptService(prisma as never)
  await service.save('u1', attempt())
  await assert.rejects(() => service.save('ghost', attempt()), (err: { statusCode?: number }) => err.statusCode === 404)
  await assert.rejects(() => service.get('u2', 'two-sum-1793976027442'), (err: { statusCode?: number }) => err.statusCode === 404)
  assert.equal((await service.get('u1', 'two-sum-1793976027442')).problemId, 'two-sum')
  assert.deepEqual(await service.list('u2'), [])
})
