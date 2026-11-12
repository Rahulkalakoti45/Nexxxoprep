import test from 'node:test'
import assert from 'node:assert/strict'
import { answeredPairs, deriveAnswerPatterns, mapSessionToReport } from './reportMapper.js'

const pair = (answer, question = 'Q?') => ({ sequence: 0, question, askedAt: null, answer, answeredAt: null })

const evidence = {
  questionsAnswered: [
    pair('Um, hello. Uh, my name is Vishu, and I think I built it with React. Basically a platform.'),
    pair(null),
    pair('   '),
    pair('Maybe it depends. I am not sure, actually. Like, I guess the server renders it.'),
    pair('Client-side rendering builds the page in the browser and server-side rendering sends HTML.'),
  ],
}

const interviewSummary = {
  strengths: ['Explained the rendering trade-off'],
  weaknesses: ['Hedged on caching'],
  keyTopics: ['SSR'],
  recommendations: ['Practise explaining hydration'],
  overallRating: 6.4,
  domainScores: [
    { domain: 'Frontend', score: 6.5, questions: 2 },
    { domain: 'Resume & Projects', score: 7, questions: 1 },
  ],
}

function voiceSession(overrides = {}) {
  return {
    role: 'SDE',
    company: 'Amazon',
    difficulty: 'Medium',
    durationSeconds: 497,
    metadata: { evidence },
    scores: [
      { domain: 'overall', value: 64 },
      { domain: 'technical', value: 60 },
    ],
    roadmap: [],
    feedbackReport: {
      id: 'r1',
      sessionId: 's1',
      overallScore: 64,
      hesitationScore: 0,
      summary: 'Overall rating: 6.4/10',
      aiFeedback: { interviewSummary },
      createdAt: '2026-10-10T10:05:32.000Z',
    },
    ...overrides,
  }
}

test('answeredPairs keeps only the questions the candidate actually answered', () => {
  assert.equal(answeredPairs(evidence).length, 3)
  assert.deepEqual(answeredPairs(null), [])
  assert.deepEqual(answeredPairs({ questionsAnswered: 'nope' }), [])
})

test('deriveAnswerPatterns measures length, hesitation, consistency, hedges and fillers', () => {
  const patterns = deriveAnswerPatterns(answeredPairs(evidence))
  assert.equal(patterns.averageAnswerLength, 15) // (18 + 15 + 13) / 3 words
  assert.equal(patterns.hesitationScore, 67) // 2 of 3 answers contain hedging language
  assert.equal(patterns.hedgeCount, 4) // I think, maybe, not sure, I guess
  assert.equal(patterns.fillerCount, 5) // Um, Uh, Basically, actually, Like
  assert.equal(patterns.consistencyScore, 50) // 90 - min(45, |65 - 15| * 0.8)

  assert.deepEqual(deriveAnswerPatterns([]), {
    averageAnswerLength: 0,
    hesitationScore: 0,
    consistencyScore: 0,
    hedgeCount: 0,
    fillerCount: 0,
  })
})

test('a voice interview report shows real numbers instead of zeros', () => {
  const report = mapSessionToReport(voiceSession())
  assert.equal(report.overallScore, 64)
  assert.equal(report.level, 'Developing')
  assert.equal(report.recommendation, 'Practise explaining hydration')
  assert.equal(report.questionCount, 3)
  assert.equal(report.patternAnalysis.averageAnswerLength, 15)
  assert.equal(report.patternAnalysis.hesitationScore, 67)
  assert.equal(report.intelligence.patternAnalysis.hesitationWordsDetected, 4)
  assert.deepEqual(report.weaknessSummary, ['Hedged on caching'])
  // Topic scores are rated 0-10 by the summary and shown on the report's 0-100 scale.
  assert.deepEqual(report.domainBreakdown, [
    { domain: 'Frontend', avgScore: 65, count: 2 },
    { domain: 'Resume & Projects', avgScore: 70, count: 1 },
  ])
})

test('without topic scores the stored score rows are used, minus the overall rating', () => {
  const session = voiceSession({
    feedbackReport: { ...voiceSession().feedbackReport, aiFeedback: { interviewSummary: { ...interviewSummary, domainScores: undefined } } },
  })
  assert.deepEqual(mapSessionToReport(session).domainBreakdown, [{ domain: 'technical', avgScore: 60, count: 1 }])
})

test('a report whose summary could not be written still gets the measured numbers', () => {
  const session = voiceSession({
    scores: [{ domain: 'overall', value: 0 }],
    feedbackReport: {
      ...voiceSession().feedbackReport,
      overallScore: 0,
      aiFeedback: { interviewSummary: { strengths: ['Not Evaluated'], weaknesses: ['Not Evaluated'], keyTopics: ['Not Evaluated'], recommendations: ['Not Evaluated'], overallRating: 0 } },
    },
  })
  const report = mapSessionToReport(session)
  assert.equal(report.overallScore, 0)
  assert.equal(report.recommendation, 'Not Evaluated')
  assert.deepEqual(report.domainBreakdown, [])
  assert.equal(report.questionCount, 3)
  assert.equal(report.patternAnalysis.averageAnswerLength, 15)
})

test('sessions without saved evidence report zero questions rather than failing', () => {
  const report = mapSessionToReport(voiceSession({ metadata: {} }))
  assert.equal(report.questionCount, 0)
  assert.equal(report.patternAnalysis.averageAnswerLength, 0)
})

test('classic reports that stored a full uiReport are passed through untouched', () => {
  const stored = { overallScore: 81, level: 'Good', answers: [{ id: 1 }], patternAnalysis: { averageAnswerLength: 50 }, config: { role: 'SDE' } }
  const report = mapSessionToReport(voiceSession({ feedbackReport: { ...voiceSession().feedbackReport, overallScore: 81, aiFeedback: { uiReport: stored } } }))
  assert.equal(report.overallScore, 81)
  assert.equal(report.answers.length, 1)
  assert.equal(report.patternAnalysis.averageAnswerLength, 50)
  assert.equal(report.questionCount, undefined, 'the page falls back to answers.length for these')
})

test('the behavior section data is still attached', () => {
  const report = mapSessionToReport(
    voiceSession({ metadata: { evidence, behaviorReport: { source: 'browser', finalizedAt: 'x', behaviorScore: 8, engagementScore: 8.3, attentionScore: 9.8, warningCount: 0 } } }),
  )
  assert.equal(report.behavior.overall, 8)
})

test('buildQuestionReviews pairs each answer with its coaching and its time in the interview', async () => {
  const { buildQuestionReviews } = await import('./reportMapper.js')
  const ev = {
    transcriptStatistics: { firstEntryAt: '2026-11-01T10:00:00.000Z' },
    questionsAnswered: [
      { sequence: 1, question: 'Tell me about MedXNet.', askedAt: '2026-11-01T10:01:05.000Z', answer: 'Um, I built it with React.', answeredAt: null },
      { sequence: 3, question: 'Skipped?', askedAt: '2026-11-01T10:03:00.000Z', answer: '  ', answeredAt: null },
      { sequence: 5, question: 'Why Redis?', askedAt: null, answer: 'For caching sessions.', answeredAt: null },
    ],
  }
  const summary = {
    questionFeedback: [
      { sequence: 1, topic: 'Projects', verdict: 'weak', quote: 'I built it with React', whatWorked: '', whatWasMissing: 'No architecture.', betterAnswer: 'MedXNet is…' },
    ],
  }

  const reviews = buildQuestionReviews(ev, summary)
  assert.equal(reviews.length, 2, 'unanswered questions are left out')
  assert.equal(reviews[0].askedAtSeconds, 65)
  assert.equal(reviews[0].verdict, 'weak')
  assert.equal(reviews[0].fillerCount, 1)
  assert.equal(reviews[1].askedAtSeconds, null)
  assert.equal(reviews[1].verdict, null, 'a question without coaching still shows the exchange')
  assert.deepEqual(buildQuestionReviews(null, summary), [])
})
