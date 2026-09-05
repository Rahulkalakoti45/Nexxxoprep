import { toPrismaJson, type DatabaseClient } from '@nexoprep/database'
import type { EventBus } from '@nexoprep/events'
import { NotFoundError } from '@nexoprep/shared'
import type { ActiveSessionState, InterviewMode, SessionStatus, TranscriptEntryInput } from '@nexoprep/types'
import type { MemoryService } from '@nexoprep/memory-service'

export interface SessionRoundSeed {
  sequence: number
  name: string
  domain: string
}

export interface CreateSessionInput {
  userId: string
  role: string
  company: string
  difficulty: string
  mode: InterviewMode
  metadata: Record<string, unknown>
}

export interface UpdateSessionStateInput {
  status?: SessionStatus | undefined
  currentRoundId?: string | undefined
  currentQuestionId?: string | undefined
  activeSpeaker?: ActiveSessionState['activeSpeaker'] | undefined
  metadata: Record<string, unknown>
}

export class SessionService {
  constructor(
    private readonly prisma: DatabaseClient,
    private readonly memory: MemoryService,
    private readonly events: EventBus,
  ) {}

  async createSession(input: CreateSessionInput) {
    const roundSeeds = this.parseRoundSeeds(input.metadata)
    const session = await this.prisma.interviewSession.create({
      data: {
        userId: input.userId,
        role: input.role,
        company: input.company,
        difficulty: input.difficulty,
        mode: input.mode,
        status: 'active',
        startedAt: new Date(),
        metadata: toPrismaJson(input.metadata),
      },
    })

    const roundIdByLabel = await this.seedRounds(session.id, roundSeeds)
    const metadata = {
      ...input.metadata,
      roundIdByLabel,
      lifecycle: 'active',
    }

    await this.prisma.interviewSession.update({
      where: { id: session.id },
      data: { metadata: toPrismaJson(metadata) },
    })

    const state = this.toActiveState(
      { ...session, metadata: toPrismaJson(metadata) as unknown },
      metadata,
    )
    await this.memory.saveActiveSession(state)
    await this.persistEvent('SESSION_STARTED', session.id, input.userId, { state })
    await this.safePublish(
      this.events.create('SESSION_STARTED', {
        sessionId: session.id,
        userId: input.userId,
        state,
      }),
    )

    return this.prisma.interviewSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { rounds: { orderBy: { sequence: 'asc' } } },
    })
  }

  async restoreSession(sessionId: string): Promise<ActiveSessionState> {
    const cached = await this.memory.getActiveSession(sessionId)
    if (cached) return cached

    const session = await this.prisma.interviewSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundError('Interview session', { sessionId })

    const state = this.toActiveState(session, session.metadata as Record<string, unknown>)
    await this.memory.saveActiveSession(state)
    return state
  }

  async updateState(sessionId: string, input: UpdateSessionStateInput): Promise<ActiveSessionState> {
    const existing = await this.prisma.interviewSession.findUnique({ where: { id: sessionId } })
    if (!existing) throw new NotFoundError('Interview session', { sessionId })

    const completedAt = input.status === 'completed' ? new Date() : existing.completedAt
    const durationSeconds = completedAt && existing.startedAt
      ? Math.max(0, Math.round((completedAt.getTime() - existing.startedAt.getTime()) / 1000))
      : existing.durationSeconds

    const lifecycle =
      input.status === 'completed'
        ? 'completed'
        : input.metadata?.lifecycle === 'report_generated'
          ? 'report_generated'
          : (existing.metadata as Record<string, unknown>)?.lifecycle ?? 'active'

    const updated = await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: input.status ?? existing.status,
        metadata: toPrismaJson({
          ...(existing.metadata as Record<string, unknown>),
          ...input.metadata,
          lifecycle: input.status === 'completed' ? 'completed' : lifecycle,
        }),
        completedAt,
        durationSeconds,
      },
    })

    const state: ActiveSessionState = {
      sessionId: updated.id,
      userId: updated.userId,
      status: updated.status,
      currentRoundId: input.currentRoundId,
      currentQuestionId: input.currentQuestionId,
      activeSpeaker: input.activeSpeaker,
      updatedAt: updated.updatedAt.toISOString(),
      metadata: updated.metadata as Record<string, unknown>,
    }

    await this.memory.saveActiveSession(state)
    if (input.activeSpeaker) await this.memory.setActiveSpeaker(sessionId, input.activeSpeaker)
    await this.persistEvent('SESSION_UPDATED', sessionId, updated.userId, { state })
    await this.safePublish(this.events.create('SESSION_UPDATED', { sessionId, userId: updated.userId, state }))

    return state
  }

  async appendTranscript(input: TranscriptEntryInput) {
    const session = await this.prisma.interviewSession.findUnique({ where: { id: input.sessionId } })
    if (!session) throw new NotFoundError('Interview session', { sessionId: input.sessionId })

    const resolvedRoundId = await this.resolveRoundId(input.sessionId, input.roundId, session.metadata)
    const sequence = await this.resolveSequence(input.sessionId, input.sequence)

    const transcript = await this.prisma.transcript.create({
      data: {
        sessionId: input.sessionId,
        roundId: resolvedRoundId,
        speaker: input.speaker,
        content: input.content,
        sequence,
        startedAt: input.startedAt ?? null,
        endedAt: input.endedAt ?? null,
        confidence: input.confidence ?? null,
        metadata: toPrismaJson(input.metadata ?? {}),
      },
    })

    await this.memory.bufferTranscript(input.sessionId, {
      sequence: input.sequence,
      speaker: input.speaker,
      content: input.content,
      receivedAt: new Date().toISOString(),
    })

    await this.persistEvent('TRANSCRIPT_UPDATED', input.sessionId, session.userId, {
      transcriptId: transcript.id,
      sequence: transcript.sequence,
      content: transcript.content,
      speaker: transcript.speaker,
    })

    await this.safePublish(
      this.events.create('TRANSCRIPT_UPDATED', {
        sessionId: input.sessionId,
        userId: session.userId,
        transcriptId: transcript.id,
        sequence: transcript.sequence,
        content: transcript.content,
        speaker: transcript.speaker,
      }),
    )

    return transcript
  }

  async getHistory(userId: string, limit = 25) {
    return this.prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        feedbackReport: true,
        scores: true,
        roadmap: true,
      },
    })
  }

  private toActiveState(
    session: { id: string; userId: string; status: SessionStatus; updatedAt: Date; metadata: unknown },
    metadata: Record<string, unknown>,
  ): ActiveSessionState {
    return {
      sessionId: session.id,
      userId: session.userId,
      status: session.status,
      updatedAt: session.updatedAt.toISOString(),
      metadata,
    }
  }

  private parseRoundSeeds(metadata: Record<string, unknown>): SessionRoundSeed[] {
    const raw = metadata.rounds
    if (!Array.isArray(raw)) return []
    return raw
      .map((item, index) => {
        const row = item as Record<string, unknown>
        const name = String(row.name ?? row.label ?? `Round ${index + 1}`)
        const domain = String(row.domain ?? 'general')
        const sequence = Number.isFinite(Number(row.sequence)) ? Number(row.sequence) : index
        return { sequence, name, domain }
      })
      .filter((row) => row.name.length > 0)
  }

  private async seedRounds(sessionId: string, rounds: SessionRoundSeed[]): Promise<Record<string, string>> {
    if (!rounds.length) return {}
    const created = await Promise.all(
      rounds.map((round) =>
        this.prisma.interviewRound.create({
          data: {
            sessionId,
            sequence: round.sequence,
            name: round.name,
            domain: round.domain,
            status: round.sequence === 0 ? 'active' : 'pending',
          },
        }),
      ),
    )
    return Object.fromEntries(created.map((round) => [round.name, round.id]))
  }

  private async resolveRoundId(
    sessionId: string,
    roundId: string | undefined,
    sessionMetadata: unknown,
  ): Promise<string | null> {
    if (!roundId) return null

    const existing = await this.prisma.interviewRound.findFirst({
      where: { id: roundId, sessionId },
      select: { id: true },
    })
    if (existing) return existing.id

    const metadata = (sessionMetadata ?? {}) as Record<string, unknown>
    const roundIdByLabel = metadata.roundIdByLabel as Record<string, string> | undefined
    if (roundIdByLabel?.[roundId]) {
      return roundIdByLabel[roundId]
    }

    const byName = await this.prisma.interviewRound.findFirst({
      where: { sessionId, name: roundId },
      select: { id: true },
    })
    return byName?.id ?? null
  }

  private async resolveSequence(sessionId: string, requested: number): Promise<number> {
    const latest = await this.prisma.transcript.findFirst({
      where: { sessionId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    })
    const next = (latest?.sequence ?? -1) + 1
    if (latest && requested <= latest.sequence) return next
    return requested
  }

  private async safePublish(event: Parameters<EventBus['publish']>[0]): Promise<void> {
    try {
      await this.events.publish(event)
    } catch {
      // Realtime fan-out must not fail persistence APIs
    }
  }

  private async persistEvent(type: string, sessionId: string, userId: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.eventLog.create({
        data: {
          type,
          sessionId,
          userId,
          payload: toPrismaJson(payload),
          severity: 'info',
        },
      })
    } catch {
      // Event log failure must not block transcript/session persistence
    }
  }
}
