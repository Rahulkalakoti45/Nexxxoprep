import test from 'node:test'
import assert from 'node:assert/strict'
import type { InterviewSummary } from '@nexoprep/types'
import { buildPracticeProgress, topicKey, type PastReport } from './practice-history.service.js'

function summary(domains: Array<[string, number]>, extra: Partial<InterviewSummary> = {}): InterviewSummary {
  return {
    strengths: [],
    weaknesses: [],
    keyTopics: [],
    recommendations: [],
    overallRating: 6,
    generatedAt: '',
    domainScores: domains.map(([domain, score]) => ({ domain, score, questions: 1 })),
    ...extra,
  }
}

function report(sessionId: string, day: number, s: InterviewSummary | null): PastReport {
  return { sessionId, completedAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`, role: 'SDE', company: 'X', overallScore: 60, summary: s }
}

test('topicKey treats spelling variants of a topic as the same topic', () => {
  assert.equal(topicKey('Frontend Development'), topicKey('front-end'))
  assert.equal(topicKey('System Design'), topicKey('system design concepts'))
  assert.notEqual(topicKey('Frontend'), topicKey('Backend'))
})

test('weak spots are tracked across sessions and labelled by trend', () => {
  const progress = buildPracticeProgress([
    // Given out of order on purpose.
    report('s3', 3, summary([['System Design', 4.5], ['Frontend', 7.5], ['Databases', 4], ['Behavioral', 5]])),
    report('s1', 1, summary([['System Design', 4], ['Front-end Development', 5], ['Databases', 3], ['Projects', 8]])),
    report('s2', 2, summary([['system design', 4.2], ['Databases', 5.5]])),
  ])

  assert.equal(progress.sessionCount, 3)
  assert.deepEqual(progress.sessions.map((s) => s.sessionId), ['s1', 's2', 's3'])

  const byTopic = Object.fromEntries(progress.weakSpots.map((w) => [w.topic, w.trend]))
  assert.deepEqual(byTopic, {
    'System Design': 'still_weak', // 4 -> 4.5
    Databases: 'improving', // 3 -> 4
    Frontend: 'resolved', // 5 -> 7.5
    Behavioral: 'new', // first seen, weak, in the latest session
  })
  assert.ok(!('Projects' in byTopic), 'a topic that was never weak is not a weak spot')

  // Resolved topics are not revisited; still-weak topics come first, then new ones, then improving ones.
  assert.deepEqual(progress.nextFocus.map((f) => f.topic), ['System Design', 'Behavioral', 'Databases'])
  assert.deepEqual(progress.nextFocus[0], { topic: 'System Design', timesFlagged: 3, lastScore: 4.5 })
})

test('per-question verdicts count when a topic has no domain score', () => {
  const progress = buildPracticeProgress([
    report('s1', 1, summary([], {
      questionFeedback: [
        { sequence: 0, topic: 'Caching', verdict: 'weak', quote: null, whatWorked: '', whatWasMissing: '', betterAnswer: '' },
        { sequence: 2, topic: 'caching', verdict: 'okay', quote: null, whatWorked: '', whatWasMissing: '', betterAnswer: '' },
      ],
    })),
  ])
  assert.deepEqual(progress.weakSpots.map((w) => [w.topic, w.scores[0]?.score]), [['Caching', 4.5]])
  assert.equal(progress.weakSpots[0]?.trend, 'still_weak', 'a single session has nothing to compare against')
})

test('no reports, or reports without a summary, give an empty history', () => {
  assert.deepEqual(buildPracticeProgress([]), { sessionCount: 0, sessions: [], weakSpots: [], nextFocus: [] })
  const progress = buildPracticeProgress([report('s1', 1, null)])
  assert.equal(progress.sessionCount, 1)
  assert.equal(progress.sessions[0]?.technical, null)
  assert.deepEqual(progress.nextFocus, [])
})
