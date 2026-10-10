import test from 'node:test'
import assert from 'node:assert/strict'
import type { InterviewEvidence } from '@nexoprep/types'
import {
  InterviewSummaryService,
  clampScore,
  parseDimensionScores,
  parseDomainScores,
  parseJsonObject,
} from './interview-summary.service.js'
import { GeminiService } from './gemini.service.js'

function evidence(): InterviewEvidence {
  return {
    interviewMetadata: {
      sessionId: 's1',
      userId: 'u1',
      role: 'SDE',
      company: 'Amazon',
      difficulty: 'Medium',
      mode: 'ai_simulated',
      status: 'active',
      candidateName: 'Vishu',
      interviewStage: 'COMPLETED',
      startedAt: null,
      completedAt: null,
      durationSeconds: 0,
    },
    transcriptStatistics: { totalEntries: 4, candidateEntries: 2 },
    questionsAsked: ['Explain client-side rendering versus server-side rendering.', 'Tell me about MedXNet.'],
    questionsAnswered: [
      {
        sequence: 0,
        question: 'Explain client-side rendering versus server-side rendering.',
        askedAt: null,
        answer: 'Client-side rendering builds the page in the browser, server-side rendering sends ready HTML so SEO is better.',
        answeredAt: null,
      },
      {
        sequence: 2,
        question: 'Tell me about MedXNet.',
        askedAt: null,
        answer: 'MedXNet is a healthcare coordination platform I built with React.',
        answeredAt: null,
      },
    ],
    technicalTopics: { covered: [], strong: [], weak: [], questionTopics: [] },
    communicationEvidence: [],
    strengthsObserved: [],
    weaknessesObserved: [],
    unansweredQuestions: [],
    resumeContext: { candidateProfile: null, resumeSummary: '', atsScore: null, resumeScore: null, extractedSkills: ['react'], missingSkills: [] },
    confidenceSignals: { scoreCount: 0 },
    coverageMetrics: {},
    extractionNotes: [],
    extractedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as InterviewEvidence
}

const memory = { answerScores: [] } as never

const fakeGemini = (generateText: () => Promise<string>) =>
  ({ isConfigured: () => true, generateText }) as unknown as GeminiService

const GOOD_REPLY = {
  strengths: ['Explained the rendering trade-off clearly'],
  weaknesses: ['Did not mention hydration'],
  keyTopics: ['Client-Side Rendering (CSR)', 'Server-Side Rendering', 'Kubernetes'],
  recommendations: ['Practise explaining hydration and caching'],
  overallRating: 6.4,
  technicalScore: 6,
  communicationScore: 7.2,
  confidenceScore: 5.5,
  domainScores: [
    { domain: 'Frontend', score: 6.5, questions: 1 },
    { domain: 'Resume & Projects', score: 7, questions: 1 },
  ],
}

test('parseJsonObject reads plain, fenced and prose-wrapped JSON, and rejects truncated JSON', () => {
  assert.deepEqual(parseJsonObject('{"a":1}'), { a: 1 })
  assert.deepEqual(parseJsonObject('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(parseJsonObject('Here you go: {"a":1} Hope that helps.'), { a: 1 })
  assert.throws(() => parseJsonObject('{\n  "strengths": [\n    "Acknowledged lack of knowledge on a technical topic (SSR vs. CSR'))
})

test('clampScore keeps 0-10 numbers and rejects everything else', () => {
  assert.equal(clampScore(7.26), 7.3)
  assert.equal(clampScore('8'), 8)
  assert.equal(clampScore(14), 10)
  assert.equal(clampScore(-2), 0)
  assert.equal(clampScore(''), null)
  assert.equal(clampScore('n/a'), null)
  assert.equal(clampScore(undefined), null)
})

test('parseDimensionScores needs all three ratings; parseDomainScores drops malformed rows', () => {
  assert.deepEqual(parseDimensionScores({ technicalScore: 6, communicationScore: '7', confidenceScore: 12 }), {
    technical: 6,
    communication: 7,
    confidence: 10,
  })
  assert.equal(parseDimensionScores({ technicalScore: 6, communicationScore: 7 }), undefined)

  assert.deepEqual(
    parseDomainScores([{ domain: 'Frontend', score: 6.5, questions: 2 }, { domain: '', score: 5 }, { score: 4 }, 'x', null, { domain: 'HR', score: 'bad' }]),
    [{ domain: 'Frontend', score: 6.5, questions: 2 }],
  )
  assert.equal(parseDomainScores('nope'), undefined)
  assert.equal(parseDomainScores(Array.from({ length: 20 }, (_, i) => ({ domain: `D${i}`, score: 5 })))?.length, 8)
})

test('generateSummary uses Gemini output, including a fenced reply, and grounds keyTopics in the transcript', async () => {
  const service = new InterviewSummaryService(fakeGemini(async () => `\`\`\`json\n${JSON.stringify(GOOD_REPLY)}\n\`\`\``))
  const summary = await service.generateSummary(memory, evidence())

  assert.equal(summary.overallRating, 6.4)
  assert.deepEqual(summary.strengths, GOOD_REPLY.strengths)
  assert.deepEqual(summary.recommendations, GOOD_REPLY.recommendations)
  // Spoken topics survive; a topic nobody mentioned ("Kubernetes") is dropped.
  assert.deepEqual(summary.keyTopics, ['Client-Side Rendering (CSR)', 'Server-Side Rendering'])
  assert.deepEqual(summary.dimensionScores, { technical: 6, communication: 7.2, confidence: 5.5 })
  assert.equal(summary.domainScores?.length, 2)
})

test('generateSummary falls back to the evidence-only summary, loudly, when Gemini fails', async () => {
  const errors: unknown[][] = []
  const original = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const service = new InterviewSummaryService(fakeGemini(async () => '{"strengths": ["cut off'))
    const summary = await service.generateSummary(memory, evidence())
    assert.deepEqual(summary.strengths, ['Not Evaluated'])
    assert.equal(summary.overallRating, 0)
    assert.equal(summary.dimensionScores, undefined)
  } finally {
    console.error = original
  }
  assert.equal(errors.length, 1, 'the failure must be logged, not swallowed')
  assert.match(String(errors[0]?.[0]), /\[SUMMARY\]/)
})

test('report scores are stored on a 0-100 scale', async () => {
  const service = new InterviewSummaryService(fakeGemini(async () => JSON.stringify(GOOD_REPLY)))
  const summary = await service.generateSummary(memory, evidence())
  const { scores } = service.toReportPayload(summary, [])
  assert.deepEqual(
    scores.map((row) => [row.domain, row.value]),
    [
      ['overall', 64],
      ['technical', 60],
      ['communication', 72],
      ['confidence', 55],
    ],
  )

  const withoutDimensions = { ...summary }
  delete withoutDimensions.dimensionScores
  const fallback = service.toReportPayload(withoutDimensions, [])
  assert.deepEqual(fallback.scores.map((row) => [row.domain, row.value]), [['overall', 64]])
})

test('per-answer scores from the orchestrator are scaled to 0-100 too', () => {
  const service = new InterviewSummaryService(fakeGemini(async () => '{}'))
  const answer = { technicalDepth: 7, communication: 6, clarity: 5, completeness: 4, confidence: 8, quality: 'AVERAGE', average: 6, scoredAt: '', answerPreview: '' }
  const { scores } = service.toReportPayload(
    { strengths: [], weaknesses: [], keyTopics: [], recommendations: [], overallRating: 7, generatedAt: '' },
    [answer as never],
  )
  assert.deepEqual(scores.map((row) => row.value), [70, 70, 60, 50, 40, 80])
})

test('generateText disables thinking on flash models and fails loudly on a truncated reply', async () => {
  const realFetch = globalThis.fetch
  const realLog = console.log
  const bodies: Array<{ generationConfig: Record<string, unknown> }> = []
  let reply: unknown = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }] }
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    bodies.push(JSON.parse(init?.body ?? '{}'))
    return new Response(JSON.stringify(reply), { status: 200 })
  }) as typeof fetch
  console.log = () => {}
  try {
    const flash = new GeminiService({ GEMINI_API_KEY: 'AIzaTestKey', GEMINI_MODEL: 'gemini-2.5-flash' } as never)
    assert.equal(await flash.generateText('system', 'user'), '{"ok":true}')
    assert.deepEqual(bodies[0]?.generationConfig.thinkingConfig, { thinkingBudget: 0 })
    assert.equal(bodies[0]?.generationConfig.maxOutputTokens, 4096)

    const older = new GeminiService({ GEMINI_API_KEY: 'AIzaTestKey', GEMINI_MODEL: 'gemini-2.0-flash' } as never)
    await older.generateText('system', 'user')
    assert.equal(bodies[1]?.generationConfig.thinkingConfig, undefined, 'models without thinking must not be sent thinkingConfig')

    reply = { candidates: [{ content: { parts: [{ text: '{"strengths": ["cut' }] }, finishReason: 'MAX_TOKENS' }] }
    await assert.rejects(() => flash.generateText('system', 'user'), /truncated/)
  } finally {
    globalThis.fetch = realFetch
    console.log = realLog
  }
})
