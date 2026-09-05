import { toPrismaJson, toPrismaJsonArray, type DatabaseClient } from '@nexoprep/database'
import type { EventBus } from '@nexoprep/events'
import { NotFoundError } from '@nexoprep/shared'
import type { PersistedReport, ReportGenerationInput, ScoreInput } from '@nexoprep/types'

const SCORE_GROUPS = {
  technical: ['technical', 'dsa', 'system_design', 'coding', 'architecture'],
  communication: ['communication', 'clarity', 'structure'],
  confidence: ['confidence'],
  hesitation: ['hesitation'],
  behavioral: ['behavioral', 'emotion', 'adaptability'],
}

export class ReportService {
  constructor(
    private readonly prisma: DatabaseClient,
    private readonly events: EventBus,
  ) {}

  async generateAndStoreReport(input: ReportGenerationInput): Promise<PersistedReport> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: input.sessionId },
      include: { transcripts: { orderBy: { sequence: 'asc' } } },
    })
    if (!session) throw new NotFoundError('Interview session', { sessionId: input.sessionId })
    if (session.userId !== input.userId) throw new NotFoundError('Interview session for user', input)

    const aggregates = this.aggregateScores(input.scores)
    const transcriptSummary = this.summarizeTranscript(session.transcripts.map((item) => item.content))

    await this.prisma.$transaction(async (tx) => {
      await tx.score.createMany({
        data: input.scores.map((score) => ({
          sessionId: input.sessionId,
          domain: score.domain,
          scoreType: score.scoreType,
          value: score.value,
          weight: score.weight ?? 1,
          metadata: toPrismaJson(score.metadata ?? {}),
        })),
      })

      await tx.feedbackReport.upsert({
        where: { sessionId: input.sessionId },
        create: {
          sessionId: input.sessionId,
          userId: input.userId,
          overallScore: aggregates.overallScore,
          technicalScore: aggregates.technicalScore,
          communicationScore: aggregates.communicationScore,
          confidenceScore: aggregates.confidenceScore,
          hesitationScore: aggregates.hesitationScore,
          behavioralScore: aggregates.behavioralScore,
          summary: input.summary,
          aiFeedback: toPrismaJson(input.aiFeedback),
          behavioralSummary: toPrismaJson(input.behavioralSummary ?? {}),
          transcriptSummary,
        },
        update: {
          overallScore: aggregates.overallScore,
          technicalScore: aggregates.technicalScore,
          communicationScore: aggregates.communicationScore,
          confidenceScore: aggregates.confidenceScore,
          hesitationScore: aggregates.hesitationScore,
          behavioralScore: aggregates.behavioralScore,
          summary: input.summary,
          aiFeedback: toPrismaJson(input.aiFeedback),
          behavioralSummary: toPrismaJson(input.behavioralSummary ?? {}),
          transcriptSummary,
        },
      })

      if (input.roadmapSuggestions.length) {
        await tx.roadmap.createMany({
          data: input.roadmapSuggestions.map((item) => ({
            sessionId: input.sessionId,
            userId: input.userId,
            category: item.category,
            priority: item.priority,
            title: item.title,
            description: item.description,
            actions: toPrismaJsonArray(item.actions),
            dueAfterDays: item.dueAfterDays ?? null,
          })),
        })
      }
    })

    const saved = await this.prisma.feedbackReport.findUniqueOrThrow({ where: { sessionId: input.sessionId } })
    const report: PersistedReport = {
      id: saved.id,
      sessionId: saved.sessionId,
      userId: saved.userId,
      overallScore: saved.overallScore,
      technicalScore: saved.technicalScore,
      communicationScore: saved.communicationScore,
      confidenceScore: saved.confidenceScore,
      hesitationScore: saved.hesitationScore,
      behavioralScore: saved.behavioralScore,
      summary: saved.summary,
      createdAt: saved.createdAt.toISOString(),
    }

    await this.prisma.eventLog.create({
      data: {
        type: 'REPORT_UPDATED',
        sessionId: input.sessionId,
        userId: input.userId,
        payload: toPrismaJson({ report }),
      },
    })
    try {
      await this.events.publish(this.events.create('REPORT_UPDATED', { sessionId: input.sessionId, userId: input.userId, report }))
    } catch {
      // Non-blocking realtime fan-out
    }

    await this.prisma.interviewSession.update({
      where: { id: input.sessionId },
      data: {
        metadata: toPrismaJson({
          ...(session.metadata as Record<string, unknown>),
          lifecycle: 'report_generated',
        }),
      },
    })

    return report
  }

  async getHistoricalReports(userId: string, limit = 25) {
    return this.prisma.feedbackReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { session: true },
    })
  }

  private aggregateScores(scores: ScoreInput[]) {
    const weightedAverage = (items: ScoreInput[]) => {
      if (!items.length) return 0
      const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0)
      const weighted = items.reduce((sum, item) => sum + item.value * (item.weight ?? 1), 0)
      return Math.round(weighted / Math.max(totalWeight, 1))
    }

    const byGroup = (aliases: string[]) =>
      scores.filter((score) => aliases.some((alias) => score.domain.toLowerCase().includes(alias) || score.scoreType.toLowerCase().includes(alias)))

    const technicalScore = weightedAverage(byGroup(SCORE_GROUPS.technical))
    const communicationScore = weightedAverage(byGroup(SCORE_GROUPS.communication))
    const confidenceScore = weightedAverage(byGroup(SCORE_GROUPS.confidence))
    const hesitationScore = weightedAverage(byGroup(SCORE_GROUPS.hesitation))
    const behavioralScore = weightedAverage(byGroup(SCORE_GROUPS.behavioral))
    const overallScore = weightedAverage(scores)

    return { overallScore, technicalScore, communicationScore, confidenceScore, hesitationScore, behavioralScore }
  }

  private summarizeTranscript(contents: string[]): string {
    const joined = contents.join(' ').replace(/\s+/g, ' ').trim()
    if (!joined) return 'No transcript content was captured for this session.'
    return joined.length > 1200 ? `${joined.slice(0, 1197)}...` : joined
  }
}
