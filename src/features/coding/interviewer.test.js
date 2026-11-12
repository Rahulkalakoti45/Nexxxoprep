import test from 'node:test'
import assert from 'node:assert/strict'
import { localEvaluation, scriptedTurn, summarizeRun } from './interviewer.js'
import { PROBLEMS } from './problems.js'
import { gradeRun, prepareTests } from './harness.js'

const problem = PROBLEMS[0]

test('the scripted interviewer asks for an approach first, then lets the candidate code once complexity comes up', () => {
  assert.match(scriptedTurn({ problem, stage: 'approach', event: 'start' }).reply, /talk me through/)

  const first = scriptedTurn({ problem, stage: 'approach', event: 'message', messages: [{ role: 'candidate', content: 'I would use a hash map.' }] })
  assert.equal(first.readyToCode, false)
  assert.match(first.reply, /complexity/)

  const second = scriptedTurn({
    problem,
    stage: 'approach',
    event: 'message',
    messages: [
      { role: 'candidate', content: 'I would use a hash map.' },
      { role: 'candidate', content: 'That is O(n) time and O(n) space.' },
    ],
  })
  assert.equal(second.readyToCode, true)
})

test('the scripted interviewer reacts to test results without giving the fix', () => {
  const cases = prepareTests(problem, { includeHidden: false })
  const graded = gradeRun(problem, cases, { results: [{ actual: [0, 1] }, { actual: null }, { error: 'TypeError: boom' }] })
  const run = summarizeRun(graded)
  assert.equal(run.failures.length, 2)
  assert.match(scriptedTurn({ problem, stage: 'coding', event: 'run', lastRun: run }).reply, /input \[3,2,4\], 6 it returns null, but the answer is \[1,2\]/)
  assert.match(scriptedTurn({ problem, stage: 'coding', event: 'run', lastRun: { ...run, compileError: 'SyntaxError: x' } }).reply, /didn't run/)
  assert.match(scriptedTurn({ problem, stage: 'coding', event: 'run', lastRun: { ...run, failures: [] } }).reply, /edge cases/)
  assert.match(scriptedTurn({ problem, stage: 'coding', event: 'hint', hint: problem.hints[0] }).reply, /nudge/)
})

test('localEvaluation scores only what the tests measure', () => {
  const evaluation = localEvaluation({
    problem,
    finalRun: { passed: 5, total: 6, timedOut: true, failures: [{ hidden: true, label: 'Large input (10,000 numbers)', error: 'Time limit exceeded' }] },
    messages: [{ role: 'candidate', content: 'Two nested loops, so quadratic.' }],
    hintsUsed: 1,
  })
  assert.equal(evaluation.scores.correctness, 83)
  assert.equal(evaluation.scores.efficiency, null)
  assert.equal(evaluation.overall, 78)
  assert.equal(evaluation.generatedBy, 'local')
  assert.ok(evaluation.improvements.some((i) => i.includes('time limit')))
  assert.ok(evaluation.strengths.some((s) => s.includes('complexity')))
  assert.equal(evaluation.optimalApproach, problem.hints[2])
  assert.equal(evaluation.complexity.stated, null, 'no Big-O was written')

  const withClaim = localEvaluation({ problem, finalRun: { passed: 6, total: 6, failures: [] }, messages: [{ role: 'candidate', content: "It's O(n) time and O(n) space for the map." }] })
  assert.equal(withClaim.complexity.stated, 'O(n) time, O(n) space')
})
