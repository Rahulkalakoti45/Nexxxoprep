import { toPrismaJson, type DatabaseClient } from '@nexoprep/database'
import { NotFoundError } from '@nexoprep/shared'

const LANGUAGE_LABELS: Record<string, string> = { javascript: 'JavaScript', python: 'Python' }

/** A finished attempt as the browser sends it (and as it reads it back). */
export interface CodingAttemptInput {
  id: string
  problemId: string
  problemTitle: string
  difficulty: string
  language: string
  code: string
  messages: Array<{ role: string; content: string; kind?: string | undefined }>
  finalRun: { passed: number; total: number; [key: string]: unknown }
  evaluation: { overall: number; [key: string]: unknown }
  hintsUsed: number
  durationSeconds: number
  finishedAt: string
}

export interface CodingAttemptRecord extends CodingAttemptInput {
  languageLabel: string
  syncedAt: string
}

export interface CodingAttemptRow {
  clientAttemptId: string
  problemId: string
  problemTitle: string
  difficulty: string
  language: string
  code: string
  messages: unknown
  finalRun: unknown
  evaluation: unknown
  hintsUsed: number
  durationSeconds: number
  finishedAt: Date
  updatedAt: Date
}

const clampInt = (value: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)))

/** The columns stored for an attempt. Headline numbers are clamped so they always make sense. */
export function toAttemptData(input: CodingAttemptInput) {
  const testsTotal = clampInt(input.finalRun.total, 0, 1000)
  return {
    clientAttemptId: input.id,
    problemId: input.problemId,
    problemTitle: input.problemTitle,
    difficulty: input.difficulty,
    language: input.language,
    code: input.code,
    messages: toPrismaJson(input.messages),
    finalRun: toPrismaJson(input.finalRun),
    evaluation: toPrismaJson(input.evaluation),
    overallScore: clampInt(input.evaluation.overall, 0, 100),
    testsPassed: clampInt(input.finalRun.passed, 0, testsTotal),
    testsTotal,
    hintsUsed: clampInt(input.hintsUsed, 0, 10),
    durationSeconds: clampInt(input.durationSeconds, 0, 6 * 3600),
    finishedAt: new Date(input.finishedAt),
  }
}

/** A stored row back in the shape the browser uses, keyed by the browser's own attempt id. */
export function toAttemptRecord(row: CodingAttemptRow): CodingAttemptRecord {
  return {
    id: row.clientAttemptId,
    problemId: row.problemId,
    problemTitle: row.problemTitle,
    difficulty: row.difficulty,
    language: row.language,
    languageLabel: LANGUAGE_LABELS[row.language] ?? row.language,
    code: row.code,
    messages: Array.isArray(row.messages) ? (row.messages as CodingAttemptInput['messages']) : [],
    finalRun: row.finalRun as CodingAttemptInput['finalRun'],
    evaluation: row.evaluation as CodingAttemptInput['evaluation'],
    hintsUsed: row.hintsUsed,
    durationSeconds: row.durationSeconds,
    finishedAt: row.finishedAt.toISOString(),
    syncedAt: row.updatedAt.toISOString(),
  }
}

export class CodingAttemptService {
  constructor(private readonly prisma: DatabaseClient) {}

  /** Saves an attempt. Saving the same attempt id again updates it, so retries never duplicate. */
  async save(userId: string, input: CodingAttemptInput): Promise<CodingAttemptRecord> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) throw new NotFoundError('User', { userId })

    const data = toAttemptData(input)
    const row = await this.prisma.codingAttempt.upsert({
      where: { userId_clientAttemptId: { userId, clientAttemptId: input.id } },
      create: { userId, ...data },
      update: data,
    })
    return toAttemptRecord(row)
  }

  /** The user's most recent attempts, newest first. */
  async list(userId: string, limit = 30): Promise<CodingAttemptRecord[]> {
    const rows = await this.prisma.codingAttempt.findMany({
      where: { userId },
      orderBy: { finishedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    })
    return rows.map(toAttemptRecord)
  }

  async get(userId: string, attemptId: string): Promise<CodingAttemptRecord> {
    const row = await this.prisma.codingAttempt.findUnique({
      where: { userId_clientAttemptId: { userId, clientAttemptId: attemptId } },
    })
    if (!row) throw new NotFoundError('Coding attempt', { userId, attemptId })
    return toAttemptRecord(row)
  }
}
