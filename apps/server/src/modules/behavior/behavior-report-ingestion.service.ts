import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { FastifyBaseLogger } from 'fastify'
import { toPrismaJson, type DatabaseClient } from '@nexoprep/database'
import type { EventBus } from '@nexoprep/events'
import type { BehaviorReportFinalizedInfo } from './behavior-engine.service.js'

/**
 * BehaviorReportIngestionService (Phase 4B)
 *
 * The Behavior Engine already generates a complete, user-facing Behavior
 * Report on disk for every session — report.json, report.txt,
 * scorecard.txt, and the graph/image outputs under reports/session_<ts>/.
 * None of that generation, format, or storage is touched by this class or
 * by anything in Phase 4B: this service only observes that a report now
 * exists and records a pointer to it.
 *
 * Today, nothing durable connects a sessionId to the report.json that
 * belongs to it — report directories are named purely by timestamp, and
 * the Behavior Engine process is never told the sessionId in the first
 * place (it only reaches Node via BehaviorEngineService's in-memory
 * process map). This service closes that gap using storage that already
 * exists for exactly this kind of post-hoc bookkeeping: the session's own
 * `metadata` JSON field, the same field/pattern already used elsewhere to
 * record session lifecycle state. No new table, no schema migration.
 *
 * This class does not read, interpret, or duplicate the Behavior Report's
 * analysis. It reads report.json exactly once, to copy forward a handful
 * of already-computed numbers (so a future read path isn't forced to
 * parse the full JSON file on every request) — the JSON file itself
 * remains the sole source of truth for everything else in it.
 */
export class BehaviorReportIngestionService {
  constructor(
    private readonly prisma: DatabaseClient,
    private readonly events: EventBus,
    private readonly logger: FastifyBaseLogger,
  ) {}

  /**
   * Called once per session when BehaviorEngineService observes the
   * Behavior Report has finished writing to disk. Never throws — a
   * failure here must not affect the interview or the Behavior Engine
   * process in any way; it only means the session's metadata pointer
   * doesn't get recorded for this session.
   */
  async handleReportFinalized({ sessionId, sessionDir }: BehaviorReportFinalizedInfo): Promise<void> {
    try {
      const session = await this.prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: { userId: true, metadata: true },
      })
      if (!session) {
        this.logger.warn(
          { sessionId, sessionDir },
          '[BEHAVIOR_REPORT_INGESTION] no session found for sessionId — pointer not recorded',
        )
        return
      }

      const summary = await this.readSummary(sessionDir)
      const readyAt = new Date().toISOString()

      const existingMetadata = (session.metadata ?? {}) as Record<string, unknown>
      await this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          metadata: toPrismaJson({
            ...existingMetadata,
            behaviorReport: {
              sessionDir,
              readyAt,
              behaviorScore: summary?.behaviorScore ?? null,
              engagementScore: summary?.engagementScore ?? null,
              attentionScore: summary?.attentionScore ?? null,
              warningCount: summary?.warningCount ?? null,
            },
          }),
        },
      })

      this.logger.info(
        { sessionId, sessionDir },
        '[BEHAVIOR_REPORT_READY] behavior report pointer recorded in session metadata',
      )

      try {
        await this.events.publish(
          this.events.create('BEHAVIOR_REPORT_READY', {
            sessionId,
            userId: session.userId,
            sessionDir,
            readyAt,
            behaviorScore: summary?.behaviorScore ?? null,
            engagementScore: summary?.engagementScore ?? null,
            attentionScore: summary?.attentionScore ?? null,
            warningCount: summary?.warningCount ?? null,
          }),
        )
      } catch (error) {
        // Non-blocking realtime fan-out — same tolerance as REPORT_UPDATED's
        // publish elsewhere in the codebase.
        this.logger.warn({ sessionId, error }, '[BEHAVIOR_REPORT_INGESTION] event publish failed')
      }
    } catch (error) {
      this.logger.error(
        { sessionId, sessionDir, error },
        '[BEHAVIOR_REPORT_INGESTION_ERROR] failed to record behavior report pointer',
      )
    }
  }

  /**
   * Reads report.json purely to copy forward a few pre-computed numbers.
   * Soft-fails to null on any error (missing file, malformed JSON,
   * unexpected shape) — the pointer (sessionDir/readyAt) is still worth
   * recording even if these summary numbers can't be extracted, so this
   * never throws.
   */
  private async readSummary(sessionDir: string): Promise<{
    behaviorScore: number | null
    engagementScore: number | null
    attentionScore: number | null
    warningCount: number | null
  } | null> {
    try {
      const jsonPath = path.join(sessionDir, 'report.json')
      const raw = await readFile(jsonPath, 'utf8')
      const parsed = JSON.parse(raw) as {
        aggregation?: {
          avg_scores?: { overall?: number; engagement?: number; attention?: number }
          total_events?: number
        }
      }
      const avgScores = parsed.aggregation?.avg_scores
      return {
        behaviorScore: typeof avgScores?.overall === 'number' ? avgScores.overall : null,
        engagementScore: typeof avgScores?.engagement === 'number' ? avgScores.engagement : null,
        attentionScore: typeof avgScores?.attention === 'number' ? avgScores.attention : null,
        warningCount:
          typeof parsed.aggregation?.total_events === 'number' ? parsed.aggregation.total_events : null,
      }
    } catch (error) {
      this.logger.warn(
        { sessionDir, error },
        '[BEHAVIOR_REPORT_INGESTION] could not read report.json summary fields — pointer will be recorded without them',
      )
      return null
    }
  }
}
