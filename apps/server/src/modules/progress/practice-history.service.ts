import type { DatabaseClient } from '@nexoprep/database'
import type {
  InterviewSummary,
  PracticeFocusArea,
  PracticeProgress,
  ProgressWeakSpot,
  WeakSpotTrend,
} from '@nexoprep/types'

/** A topic scored below this (0-10) counts as a weak spot. */
export const WEAK_BELOW = 6
/** A weak spot scored at or above this in the latest session counts as resolved. */
export const RESOLVED_AT = 7
const MAX_FOCUS = 4

/** What the history needs from one stored report. */
export interface PastReport {
  sessionId: string
  completedAt: string
  role: string
  company: string
  overallScore: number
  summary: InterviewSummary | null
}

/** "Frontend Development", "frontend" and "Front-end" all describe the same topic. */
export function topicKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/front[\s-]?end/g, 'frontend')
    .replace(/back[\s-]?end/g, 'backend')
    .replace(/\b(development|dev|skills?|knowledge|concepts?|fundamentals)\b/g, '')
    .replace(/[^a-z0-9+#]+/g, '')
}

const VERDICT_SCORE = { strong: 8, okay: 6, weak: 3 } as const

/**
 * The 0-10 score each topic got in one session. Domain scores come first; a topic that only
 * appears in per-question feedback takes the average of its verdicts.
 */
function topicScoresForSession(summary: InterviewSummary | null): Map<string, { label: string; score: number }> {
  const scores = new Map<string, { label: string; score: number }>()
  if (!summary) return scores

  for (const row of summary.domainScores ?? []) {
    const key = topicKey(row.domain)
    if (key) scores.set(key, { label: row.domain, score: row.score })
  }

  const fromVerdicts = new Map<string, { label: string; total: number; count: number }>()
  for (const row of summary.questionFeedback ?? []) {
    const key = topicKey(row.topic)
    if (!key || scores.has(key)) continue
    const entry = fromVerdicts.get(key) ?? { label: row.topic, total: 0, count: 0 }
    entry.total += VERDICT_SCORE[row.verdict]
    entry.count += 1
    fromVerdicts.set(key, entry)
  }
  for (const [key, entry] of fromVerdicts) {
    scores.set(key, { label: entry.label, score: Math.round((entry.total / entry.count) * 10) / 10 })
  }
  return scores
}

function trendFor(scores: number[], latestSessionHasIt: boolean, onlyInLatest: boolean): WeakSpotTrend {
  const last = scores[scores.length - 1] as number
  if (onlyInLatest) return 'new'
  if (latestSessionHasIt && last >= RESOLVED_AT) return 'resolved'
  const firstWeak = scores.find((s) => s < WEAK_BELOW) ?? scores[0] as number
  if (last - firstWeak >= 1) return 'improving'
  return 'still_weak'
}

/**
 * Turns a candidate's past reports (any order) into their progress: scores per session, the
 * topics that were ever weak and how each is trending, and what the next interview should revisit.
 */
export function buildPracticeProgress(reports: PastReport[]): PracticeProgress {
  const ordered = reports.slice().sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  const latestSessionId = ordered[ordered.length - 1]?.sessionId

  const topics = new Map<string, { label: string; scores: Array<{ sessionId: string; score: number }> }>()
  for (const report of ordered) {
    for (const [key, { label, score }] of topicScoresForSession(report.summary)) {
      const entry = topics.get(key) ?? { label, scores: [] }
      entry.label = label // the most recent wording reads best
      entry.scores.push({ sessionId: report.sessionId, score })
      topics.set(key, entry)
    }
  }

  const weakSpots: ProgressWeakSpot[] = []
  const nextFocus: Array<PracticeFocusArea & { trend: WeakSpotTrend }> = []
  for (const { label, scores } of topics.values()) {
    const values = scores.map((s) => s.score)
    if (!values.some((v) => v < WEAK_BELOW)) continue
    const latestHasIt = scores[scores.length - 1]?.sessionId === latestSessionId
    const onlyInLatest = latestHasIt && scores.length === 1 && ordered.length > 1
    const trend = trendFor(values, latestHasIt, onlyInLatest)
    weakSpots.push({ topic: label, trend, scores })
    if (trend !== 'resolved') {
      nextFocus.push({
        trend,
        topic: label,
        timesFlagged: values.filter((v) => v < WEAK_BELOW).length,
        lastScore: values[values.length - 1] ?? null,
      })
    }
  }

  const trendOrder: Record<WeakSpotTrend, number> = { still_weak: 0, new: 1, improving: 2, resolved: 3 }
  weakSpots.sort((a, b) => trendOrder[a.trend] - trendOrder[b.trend] || a.topic.localeCompare(b.topic))
  // Still-weak topics first, then the most often flagged, then the lowest latest score.
  nextFocus.sort(
    (a, b) => trendOrder[a.trend] - trendOrder[b.trend] || b.timesFlagged - a.timesFlagged || (a.lastScore ?? 10) - (b.lastScore ?? 10),
  )

  return {
    sessionCount: ordered.length,
    sessions: ordered.map((report) => ({
      sessionId: report.sessionId,
      completedAt: report.completedAt,
      role: report.role,
      company: report.company,
      overallScore: report.overallScore,
      technical: report.summary?.dimensionScores?.technical ?? null,
      communication: report.summary?.dimensionScores?.communication ?? null,
      confidence: report.summary?.dimensionScores?.confidence ?? null,
    })),
    weakSpots,
    nextFocus: nextFocus.slice(0, MAX_FOCUS).map(({ topic, timesFlagged, lastScore }) => ({ topic, timesFlagged, lastScore })),
  }
}

function readSummary(aiFeedback: unknown): InterviewSummary | null {
  if (!aiFeedback || typeof aiFeedback !== 'object') return null
  const summary = (aiFeedback as Record<string, unknown>).interviewSummary
  return summary && typeof summary === 'object' ? (summary as InterviewSummary) : null
}

export class PracticeHistoryService {
  constructor(private readonly prisma: DatabaseClient) {}

  /** The candidate's progress over their most recent reports, optionally leaving one session out. */
  async loadProgress(userId: string, options: { excludeSessionId?: string; limit?: number } = {}): Promise<PracticeProgress> {
    const rows = await this.prisma.feedbackReport.findMany({
      where: {
        userId,
        ...(options.excludeSessionId ? { sessionId: { not: options.excludeSessionId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 20,
      include: { session: true },
    })

    return buildPracticeProgress(
      rows.map((row) => ({
        sessionId: row.sessionId,
        completedAt: (row.session?.completedAt ?? row.createdAt).toISOString(),
        role: row.session?.role ?? '',
        company: row.session?.company ?? '',
        overallScore: row.overallScore,
        summary: readSummary(row.aiFeedback),
      })),
    )
  }
}
