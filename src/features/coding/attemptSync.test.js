import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeAttempts, pendingUploads } from './attemptSync.js'

const a = (id, finishedAt, extra = {}) => ({ id, finishedAt, ...extra })

test('mergeAttempts keeps one copy per id, prefers the server copy, and sorts newest first', () => {
  const local = [a('x', '2026-11-01T00:00:00Z', { code: 'local', syncedAt: null }), a('y', '2026-11-03T00:00:00Z')]
  const remote = [a('x', '2026-11-01T00:00:00Z', { code: 'server', syncedAt: '2026-11-01T00:01:00Z' }), a('z', '2026-11-02T00:00:00Z')]
  const merged = mergeAttempts(local, remote)
  assert.deepEqual(merged.map((m) => m.id), ['y', 'z', 'x'])
  assert.equal(merged.find((m) => m.id === 'x').code, 'server')
  assert.equal(merged.find((m) => m.id === 'x').syncedAt, '2026-11-01T00:01:00Z')
})

test('mergeAttempts keeps at most 30', () => {
  const many = Array.from({ length: 40 }, (_, i) => a(`id${i}`, `2026-10-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`))
  assert.equal(mergeAttempts(many, []).length, 30)
})

test('pendingUploads finds attempts the server has never seen', () => {
  assert.deepEqual(pendingUploads([a('x', '1', { syncedAt: 'now' }), a('y', '2')]).map((p) => p.id), ['y'])
})
