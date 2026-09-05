import type { Prisma, PrismaClient } from '@prisma/client'

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  upsertByEmail(input: Prisma.UserCreateInput) {
    return this.prisma.user.upsert({
      where: { email: input.email },
      update: input,
      create: input,
    })
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  interviewHistory(userId: string, limit = 25) {
    return this.prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        scores: true,
        feedbackReport: true,
        roadmap: true,
      },
    })
  }
}

export class SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: Prisma.InterviewSessionCreateInput) {
    return this.prisma.interviewSession.create({ data: input })
  }

  findById(id: string) {
    return this.prisma.interviewSession.findUnique({
      where: { id },
      include: {
        rounds: { orderBy: { sequence: 'asc' } },
        transcripts: { orderBy: { sequence: 'asc' } },
        behaviorMetrics: true,
        emotionStates: true,
        scores: true,
        feedbackReport: true,
        roadmap: true,
        resumeAnalysis: true,
      },
    })
  }

  update(id: string, data: Prisma.InterviewSessionUpdateInput) {
    return this.prisma.interviewSession.update({ where: { id }, data })
  }

  appendTranscript(input: Prisma.TranscriptCreateInput) {
    return this.prisma.transcript.create({ data: input })
  }

  createRound(input: Prisma.InterviewRoundCreateInput) {
    return this.prisma.interviewRound.create({ data: input })
  }
}

export class ReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  createFeedbackReport(input: Prisma.FeedbackReportCreateInput) {
    return this.prisma.feedbackReport.create({ data: input })
  }

  createScores(inputs: Prisma.ScoreCreateManyInput[]) {
    return this.prisma.score.createMany({ data: inputs })
  }

  createRoadmaps(inputs: Prisma.RoadmapCreateManyInput[]) {
    return this.prisma.roadmap.createMany({ data: inputs })
  }

  findReportsByUser(userId: string, limit = 25) {
    return this.prisma.feedbackReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        session: true,
      },
    })
  }
}

export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  addBehaviorMetric(input: Prisma.BehaviorMetricCreateInput) {
    return this.prisma.behaviorMetric.create({ data: input })
  }

  addEmotionState(input: Prisma.EmotionStateCreateInput) {
    return this.prisma.emotionState.create({ data: input })
  }

  eventLogsForSession(sessionId: string, limit = 100) {
    return this.prisma.eventLog.findMany({
      where: { sessionId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    })
  }

  createEventLog(input: Prisma.EventLogCreateInput) {
    return this.prisma.eventLog.create({ data: input })
  }
}

export function createRepositories(prisma: PrismaClient) {
  return {
    users: new UserRepository(prisma),
    sessions: new SessionRepository(prisma),
    reports: new ReportRepository(prisma),
    analytics: new AnalyticsRepository(prisma),
  }
}

export type RepositoryBundle = ReturnType<typeof createRepositories>
