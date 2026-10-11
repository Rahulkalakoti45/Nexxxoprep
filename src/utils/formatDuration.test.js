import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMinutes } from './formatDuration.js'

test('anything under a minute reads "<1 min", including zero', () => {
  assert.equal(formatMinutes(0), '<1 min')
  assert.equal(formatMinutes(28), '<1 min')
  assert.equal(formatMinutes(59.4), '<1 min')
})

test('a minute or more is rounded to whole minutes, as before', () => {
  assert.equal(formatMinutes(60), '1 min')
  assert.equal(formatMinutes(497), '8 min')
  assert.equal(formatMinutes(64902), '1082 min')
})

test('missing or invalid values never print NaN', () => {
  assert.equal(formatMinutes(undefined), '<1 min')
  assert.equal(formatMinutes(null), '<1 min')
  assert.equal(formatMinutes('abc'), '<1 min')
  assert.equal(formatMinutes(-5), '<1 min')
})
