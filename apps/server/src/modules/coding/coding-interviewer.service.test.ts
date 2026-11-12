import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTurnPrompt, CodingInterviewerService, parseEvaluation, parseTurn, stripCode, type CodingEvaluationInput } from './coding-interviewer.service.js'
import type { GeminiService } from '../orchestrator/gemini.service.js'

const problem = {
  title: 'Two Sum',
  difficulty: 'Easy',
  prompt: 'Return indices of two numbers adding to target.',
  expectedComplexity: { time: 'O(n)', space: 'O(n)' },
  followUps: ['What if the array were sorted?'],
}

const code = 'function twoSum(nums, target) {\n  const seen = new Map()\n  for (let i = 0; i < nums.length; i++) {\n    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i]\n    seen.set(nums[i], i)\n  }\n}\n'

function evalInput(overrides: Partial<CodingEvaluationInput> = {}): CodingEvaluationInput {
  return {
    problem,
    language: 'javascript',
    code,
    messages: [{ role: 'candidate', content: 'I will use a hash map, O(n) time and O(n) space.' }],
    finalRun: { passed: 6, total: 6, failures: [] },
    hintsUsed: 0,
    durationSeconds: 900,
    ...overrides,
  }
}

test('stripCode removes fenced code, even an unclosed fence', () => {
  assert.equal(stripCode('Try this:\n```js\nreturn 1\n```\nDoes that help?'), 'Try this: Does that help?')
  assert.equal(stripCode('Here:\n```python\ndef f(): pass'), 'Here:')
})

test('parseTurn trims the reply, drops code and only allows readyToCode while discussing the approach', () => {
  assert.deepEqual(parseTurn('{"reply":"Sounds good, go ahead and code it.","readyToCode":true}', { stage: 'approach' }), {
    reply: 'Sounds good, go ahead and code it.',
    readyToCode: true,
  })
  assert.equal(parseTurn('{"reply":"Nice.","readyToCode":true}', { stage: 'coding' }).readyToCode, false)
  assert.equal(parseTurn('{"reply":"Like so ```x=1``` ok?"}', { stage: 'coding' }).reply, 'Like so ok?')
  assert.throws(() => parseTurn('{"reply":""}', { stage: 'coding' }))
})

test('buildTurnPrompt includes run failures but hides hidden-test inputs it was never given', () => {
  const prompt = buildTurnPrompt({
    problem,
    stage: 'coding',
    event: 'run',
    language: 'javascript',
    code,
    messages: [],
    lastRun: { passed: 4, total: 6, timedOut: true, failures: [{ hidden: true, label: 'Large input', error: 'Time limit exceeded' }, { input: '[3,3], 6', expected: '[0,1]', actual: 'null' }] },
  })
  assert.match(prompt, /Passed 4\/6 tests \(time limit exceeded\)/)
  assert.match(prompt, /Hidden test failed \(Large input\): Time limit exceeded/)
  assert.match(prompt, /input \[3,3\], 6 expected \[0,1\] got null/)
})

test('parseEvaluation computes correctness and the hint penalty itself', () => {
  const raw = JSON.stringify({
    correctness: 100, // ignored: correctness comes from the tests
    efficiency: 9,
    codeQuality: 80,
    communication: 70,
    statedComplexity: 'O(n) time and O(n) space',
    estimatedTime: 'O(n)',
    estimatedSpace: 'O(n)',
    isOptimal: true,
    strengths: ['Used a hash map'],
    improvements: ['Handle the no-answer case'],
    codeComments: [
      { snippet: 'seen.set(nums[i], i)', comment: 'Good: insert after checking, so an element never pairs with itself.' },
      { snippet: 'return -1', comment: 'Invented line, must be dropped.' },
    ],
    optimalApproach: 'One pass with a hash map. ```js\ncode\n```',
  })
  const evaluation = parseEvaluation(raw, evalInput({ finalRun: { passed: 5, total: 6, failures: [] }, hintsUsed: 1 }))
  assert.equal(evaluation.scores.correctness, 83)
  assert.equal(evaluation.scores.efficiency, 90, '0-10 scores are scaled to 0-100')
  assert.equal(evaluation.hintPenalty, 5)
  assert.equal(evaluation.overall, Math.round(0.4 * 83 + 0.2 * 90 + 0.2 * 80 + 0.2 * 70) - 5)
  assert.deepEqual(evaluation.codeComments.map((c) => c.snippet), ['seen.set(nums[i], i)'])
  assert.equal(evaluation.optimalApproach, 'One pass with a hash map.')
  assert.equal(evaluation.verdict, 'okay', 'not every test passed, so not strong')
})

test('a timed-out run caps efficiency, and many hints cap the penalty at 15', () => {
  const evaluation = parseEvaluation(
    JSON.stringify({ efficiency: 95, codeQuality: 90, communication: 90 }),
    evalInput({ finalRun: { passed: 5, total: 6, timedOut: true, failures: [] }, hintsUsed: 7 }),
  )
  assert.equal(evaluation.scores.efficiency, 40)
  assert.equal(evaluation.hintPenalty, 15)
})

test('the service refuses with 503 when Gemini is not configured', async () => {
  const service = new CodingInterviewerService({ isConfigured: () => false } as unknown as GeminiService)
  await assert.rejects(() => service.turn({ problem, stage: 'approach', event: 'start', language: 'javascript', code: '', messages: [] }), (err: { statusCode?: number }) => err.statusCode === 503)
})
