import test from 'node:test'
import assert from 'node:assert/strict'
import { PROBLEMS } from './problems.js'
import { gradeRun, outputsMatch, prepareTests, preview } from './harness.js'

// Reference solutions: every expected output in the bank must be what a correct solution returns.
const REFERENCE = {
  'two-sum': (nums, target) => {
    const seen = new Map()
    for (let i = 0; i < nums.length; i += 1) {
      if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i]
      seen.set(nums[i], i)
    }
    return null
  },
  'valid-parentheses': (s) => {
    const pairs = { ')': '(', ']': '[', '}': '{' }
    const stack = []
    for (const ch of s) {
      if (pairs[ch]) {
        if (stack.pop() !== pairs[ch]) return false
      } else stack.push(ch)
    }
    return stack.length === 0
  },
  'merge-intervals': (intervals) => {
    const sorted = intervals.slice().sort((a, b) => a[0] - b[0])
    const out = []
    for (const [s, e] of sorted) {
      const last = out[out.length - 1]
      if (last && s <= last[1]) last[1] = Math.max(last[1], e)
      else out.push([s, e])
    }
    return out
  },
  'longest-substring': (s) => {
    const last = new Map()
    let left = 0
    let best = 0
    for (let i = 0; i < s.length; i += 1) {
      if (last.has(s[i]) && last.get(s[i]) >= left) left = last.get(s[i]) + 1
      last.set(s[i], i)
      best = Math.max(best, i - left + 1)
    }
    return best
  },
  'top-k-frequent': (nums, k) => {
    const count = new Map()
    for (const n of nums) count.set(n, (count.get(n) || 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([n]) => n)
  },
  'product-except-self': (nums) => {
    const out = Array(nums.length).fill(1)
    let left = 1
    for (let i = 0; i < nums.length; i += 1) {
      out[i] = left
      left *= nums[i]
    }
    let right = 1
    for (let i = nums.length - 1; i >= 0; i -= 1) {
      out[i] *= right
      right *= nums[i]
    }
    return out
  },
}

test('every problem has a reference solution that passes all its tests', () => {
  for (const problem of PROBLEMS) {
    const solve = REFERENCE[problem.id]
    assert.ok(solve, `missing reference for ${problem.id}`)
    for (const t of prepareTests(problem)) {
      const actual = solve(...structuredClone(t.args))
      assert.ok(outputsMatch(actual, t.expected, problem.compare), `${problem.id} test ${t.index}: got ${preview(actual)}, want ${preview(t.expected)}`)
    }
  }
})

test('every problem is complete', () => {
  for (const p of PROBLEMS) {
    assert.ok(p.functionName.javascript && p.functionName.python, p.id)
    assert.ok(p.starter.javascript.includes(p.functionName.javascript), `${p.id} JS starter names the function`)
    assert.ok(p.starter.python.includes(`def ${p.functionName.python}(`), `${p.id} Python starter names the function`)
    assert.ok(p.tests.some((t) => !t.hidden) && p.tests.some((t) => t.hidden), `${p.id} has visible and hidden tests`)
    assert.equal(p.hints.length, 3, `${p.id} has three escalating hints`)
  }
})

test('outputsMatch handles order, -0 and tuples', () => {
  assert.ok(outputsMatch([1, 0], [0, 1], 'unordered'))
  assert.ok(!outputsMatch([1, 0], [0, 1]))
  assert.ok(outputsMatch([-0, 0], [0, 0]))
  assert.ok(outputsMatch([[2, 1], [0]], [[0], [2, 1]], 'unordered'))
  assert.ok(!outputsMatch([[1, 2]], [[2, 1]], 'unordered'), 'only the top level is unordered')
  assert.ok(!outputsMatch(undefined, 0))
})

test('gradeRun totals results and never reveals hidden inputs', () => {
  const problem = PROBLEMS.find((p) => p.id === 'two-sum')
  const cases = prepareTests(problem)
  const raw = {
    results: cases.map((c, i) => (i === 1 ? { error: 'TypeError: x is undefined' } : i === 3 ? { actual: [9, 9] } : { actual: c.expected, ms: 1 })),
  }
  const graded = gradeRun(problem, cases, raw)
  assert.equal(graded.total, 6)
  assert.equal(graded.passed, 4)
  assert.equal(graded.visiblePassed, 2)
  assert.equal(graded.hiddenPassed, 2)
  assert.equal(graded.results[1].error, 'TypeError: x is undefined')
  const hidden = graded.results.filter((r) => r.hidden)
  assert.ok(hidden.every((r) => r.input === null && r.expected === null && r.actual === null))
  assert.equal(graded.results[5].label, 'Large input (10,000 numbers)')
})

test('preview trims long values', () => {
  assert.equal(preview([1, 2]), '[1,2]')
  assert.ok(preview(Array(500).fill(1)).endsWith('…'))
})
