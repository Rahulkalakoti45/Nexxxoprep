import { toPrismaJson, type DatabaseClient } from '@nexoprep/database'
import { NotFoundError } from '@nexoprep/shared'
import type { AnalyticsSnapshot, BehaviorMetricInput, EmotionStateInput } from '@nexoprep/types'

export class AnalyticsService {
  constructor(private readonly prisma: DatabaseClient) {}

  async recordBehaviorMetric(input: BehaviorMetricInput) {
    await this.ensureSession(input.sessionId)
    return this.prisma.behaviorMetric.create({
      data: {
        sessionId: input.sessionId,
        metricType: input.metricType,
        value: input.value,
        confidence: input.confidence ?? null,
        source: input.source,
        capturedAt: input.capturedAt ?? new Date(),
        metadata: toPrismaJson(input.metadata ?? {}),
      },
    })
  }

  async recordEmotionState(input: EmotionStateInput) {
    await this.ensureSession(input.sessionId)
    return this.prisma.emotionState.create({
      data: {
        sessionId: input.sessionId,
        emotion: input.emotion,
        intensity: input.intensity,
        confidence: input.confidence ?? null,
        source: input.source,
        capturedAt: input.capturedAt ?? new Date(),
        metadata: toPrismaJson(input.metadata ?? {}),
      },
    })
  }

  async getUserSnapshot(userId: string): Promise<AnalyticsSnapshot> {
    const sessions = await this.prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        scores: true,
        feedbackReport: true,
        behaviorMetrics: true,
        emotionStates: true,
      },
    })

    const reports = sessions.map((session) => session.feedbackReport).filter((report): report is NonNullable<typeof report> => Boolean(report))
    const allScores = sessions.flatMap((session) => session.scores)
    const weakAreas = Object.values(
      allScores.reduce<Record<string, { domain: string; total: number; count: number }>>((acc, score) => {
        const current = acc[score.domain] ?? { domain: score.domain, total: 0, count: 0 }
        current.total += score.value
        current.count += 1
        acc[score.domain] = current
        return acc
      }, {}),
    )
      .map((item) => ({ domain: item.domain, averageScore: Math.round(item.total / Math.max(item.count, 1)) }))
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 5)

    return {
      userId,
      interviewCount: sessions.length,
      averageOverallScore: this.average(reports.map((report) => report.overallScore)),
      averageTechnicalScore: this.average(reports.map((report) => report.technicalScore)),
      averageCommunicationScore: this.average(reports.map((report) => report.communicationScore)),
      weakAreas,
      performanceTrend: reports.map((report) => ({
        sessionId: report.sessionId,
        completedAt: report.createdAt.toISOString(),
        score: report.overallScore,
      })),
      emotionalMetrics: this.averageByKey(sessions.flatMap((session) => session.emotionStates), 'emotion', 'intensity'),
      communicationMetrics: this.averageByKey(
        sessions.flatMap((session) => session.behaviorMetrics).filter((metric) => metric.metricType.includes('communication')),
        'metricType',
        'value',
      ),
    }
  }

  private average(values: number[]): number {
    if (!values.length) return 0
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  }

  private averageByKey<T extends Record<string, unknown>>(items: T[], keyField: keyof T, valueField: keyof T): Record<string, number> {
    const grouped = items.reduce<Record<string, { total: number; count: number }>>((acc, item) => {
      const key = String(item[keyField])
      const value = Number(item[valueField])
      if (!Number.isFinite(value)) return acc
      const current = acc[key] ?? { total: 0, count: 0 }
      current.total += value
      current.count += 1
      acc[key] = current
      return acc
    }, {})

    return Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, Math.round(value.total / Math.max(value.count, 1))]))
  }

  private async ensureSession(sessionId: string): Promise<void> {
    const exists = await this.prisma.interviewSession.findUnique({ where: { id: sessionId }, select: { id: true } })
    if (!exists) throw new NotFoundError('Interview session', { sessionId })
  }
}
