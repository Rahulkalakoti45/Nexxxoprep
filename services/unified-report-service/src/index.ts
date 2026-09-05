import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { DatabaseClient } from '@nexoprep/database'
import { NotFoundError } from '@nexoprep/shared'
import type { UnifiedReportReadinessStatus, UnifiedReportResponse } from '@nexoprep/types'

interface BehaviorReportPointer {
  sessionDir?: string
  readyAt?: string
  behaviorScore?: number | null
  engagementScore?: number | null
  attentionScore?: number | null
  warningCount?: number | null
}

interface BehaviorReportJsonSummary {
  behaviorScore: number | null
  engagementScore: number | null
  attentionScore: number | null
  warningCount: number | null
}

/**
 * UnifiedReportService (Phase 4C)
 *
 * Read-only aggregation layer. Every subsystem this class reads from —
 * ResumeAnalysis, FeedbackReport, Transcript, and the Behavior Report
 * pointer on InterviewSession.metadata — already has an owning service
 * that generates and persists it. This class introduces no new
 * intelligence, no new scoring, and no new storage: it looks up what
 * already exists and assembles a single response.
 *
 * report.json (written by the Behavior Engine) is read directly off disk,
 * exactly like BehaviorReportIngestionService already does, and is never
 * written to Postgres.
 */
export class UnifiedReportService {
  constructor(private readonly prisma: DatabaseClient) {}

  async getUnifiedReport(sessionId: string, userId: string): Promise<UnifiedReportResponse> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        transcripts: { orderBy: { sequence: 'asc' } },
        feedbackReport: true,
      },
    })
    if (!session) throw new NotFoundError('Interview session', { sessionId })
    // Mirrors ReportService's ownership check exactly: no auth layer, so
    // ownership is enforced by comparing the session's userId to the
    // caller-supplied userId. A mismatch looks identical to "not found".
    if (session.userId !== userId) throw new NotFoundError('Interview session for user', { sessionId, userId })

    const interviewCompleted = session.status === 'completed'

    // Resume ownership: resolved by userId, not sessionId — reusing the
    // exact query pattern already used by ResumeService.getLatest.
    const resumeAnalysis = await this.prisma.resumeAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const feedbackReport = session.feedbackReport

    const metadata = (session.metadata ?? {}) as Record<string, unknown>
    const behaviorPointer = metadata.behaviorReport as BehaviorReportPointer | undefined

    let behaviorLive: BehaviorReportJsonSummary | null = null
    let behaviorSource: 'report.json' | 'cached_metadata' | null = null
    if (behaviorPointer?.sessionDir) {
      behaviorLive = await this.readBehaviorReportJson(behaviorPointer.sessionDir)
      behaviorSource = behaviorLive ? 'report.json' : 'cached_metadata'
    }

    const behaviorScore = behaviorLive?.behaviorScore ?? behaviorPointer?.behaviorScore ?? null
    const engagementScore = behaviorLive?.engagementScore ?? behaviorPointer?.engagementScore ?? null
    const attentionScore = behaviorLive?.attentionScore ?? behaviorPointer?.attentionScore ?? null
    const warningCount = behaviorLive?.warningCount ?? behaviorPointer?.warningCount ?? null

    const resumeStatus: UnifiedReportReadinessStatus = resumeAnalysis ? 'ready' : 'unavailable'

    const interviewStatus: UnifiedReportReadinessStatus = feedbackReport
      ? 'ready'
      : interviewCompleted
        ? 'unavailable'
        : 'pending'

    const behaviorStatus: UnifiedReportReadinessStatus = behaviorPointer
      ? 'ready'
      : interviewCompleted
        ? 'unavailable'
        : 'pending'

    const conversationStatus: UnifiedReportReadinessStatus =
      session.transcripts.length > 0 ? 'ready' : interviewCompleted ? 'unavailable' : 'pending'

    return {
      sessionId: session.id,
      userId: session.userId,
      sessionStatus: session.status,
      resume: {
        status: resumeStatus,
        resumeScore: resumeAnalysis?.resumeScore ?? null,
        atsScore: resumeAnalysis?.atsScore ?? null,
        extractedSkills: resumeAnalysis?.extractedSkills ?? [],
        missingSkills: resumeAnalysis?.missingSkills ?? [],
        suggestions: resumeAnalysis?.suggestions ?? [],
        createdAt: resumeAnalysis?.createdAt?.toISOString() ?? null,
      },
      interview: {
        status: interviewStatus,
        overallScore: feedbackReport?.overallScore ?? null,
        technicalScore: feedbackReport?.technicalScore ?? null,
        communicationScore: feedbackReport?.communicationScore ?? null,
        confidenceScore: feedbackReport?.confidenceScore ?? null,
        hesitationScore: feedbackReport?.hesitationScore ?? null,
        behavioralScore: feedbackReport?.behavioralScore ?? null,
        summary: feedbackReport?.summary ?? null,
        createdAt: feedbackReport?.createdAt?.toISOString() ?? null,
      },
      behavior: {
        status: behaviorStatus,
        behaviorScore,
        engagementScore,
        attentionScore,
        warningCount,
        source: behaviorPointer ? behaviorSource : null,
      },
      conversation: {
        status: conversationStatus,
        // Reuses FeedbackReport.transcriptSummary rather than generating a
        // second transcript summary.
        transcriptSummary: feedbackReport?.transcriptSummary ?? null,
        transcriptCount: session.transcripts.length,
      },
      composite: {
        resumeScore: resumeAnalysis?.resumeScore ?? null,
        interviewOverallScore: feedbackReport?.overallScore ?? null,
        behaviorScore,
        computed: false,
      },
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Reads report.json purely to surface current numbers in the response.
   * Never persisted. Soft-fails to null on any error (missing file,
   * malformed JSON, unexpected shape) so the caller can fall back to the
   * cached metadata values instead — same tolerance as
   * BehaviorReportIngestionService.readSummary.
   */
  private async readBehaviorReportJson(sessionDir: string): Promise<BehaviorReportJsonSummary | null> {
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
    } catch {
      return null
    }
  }
}
