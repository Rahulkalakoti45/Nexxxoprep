import { toPrismaJson, type DatabaseClient } from '@nexoprep/database'
import type {
  AnswerQuality,
  CommunicationEvidenceEntry,
  ConfidenceSignalEntry,
  ConfidenceSignals,
  CoverageMetrics,
  EvidenceQAPair,
  EvidenceSource,
  EvidenceTranscriptEntry,
  InterviewEvidence,
  InterviewMetadataEvidence,
  ResumeContextEvidence,
  TechnicalTopicsEvidence,
  TranscriptStatistics,
} from '@nexoprep/types'
import type { ConversationMemory } from '../conversation/memory.service.js'

const FILLER_WORD_PATTERN = /\b(um+|uh+|like|you know|basically|actually|sort of|kind of)\b/gi

/**
 * EvidenceExtractionService
 *
 * Transforms a completed interview (persisted transcript + stored interview
 * metadata + candidate profile/resume) into a single structured evidence
 * object. This is a purely deterministic, non-LLM layer: it never invents,
 * infers meaning, or guesses at content that isn't already present in the
 * transcript, the conversation memory, or the database.
 *
 * It is intentionally decoupled from Gemini and from report generation so
 * later phases (technical reports, behavioral reports, dashboard analytics,
 * progress tracking, roadmap generation) can all consume the same evidence
 * object without re-deriving it from raw transcript rows.
 */
export class EvidenceExtractionService {
  constructor(private readonly prisma: DatabaseClient) {}

  /**
   * Extract evidence for a session and persist it onto the InterviewSession's
   * existing `metadata` JSON column (no schema change) so future phases can
   * read it back even after the Redis conversation memory has been cleared.
   */
  async extractAndPersist(sessionId: string, memory: ConversationMemory): Promise<InterviewEvidence> {
    const evidence = await this.extractEvidence(sessionId, memory)

    try {
      const session = await this.prisma.interviewSession.findUnique({ where: { id: sessionId } })
      const existingMetadata = (session?.metadata || {}) as Record<string, unknown>
      await this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          metadata: toPrismaJson({
            ...existingMetadata,
            evidence,
          }),
        },
      })
    } catch (err) {
      console.error('[EVIDENCE] failed to persist evidence to session metadata', err)
    }

    return evidence
  }

  async extractEvidence(sessionId: string, memory: ConversationMemory): Promise<InterviewEvidence> {
    const notes: string[] = []

    const [session, transcriptRows, resumeRecord] = await Promise.all([
      this.prisma.interviewSession.findUnique({ where: { id: sessionId } }),
      this.prisma.transcript.findMany({ where: { sessionId }, orderBy: { sequence: 'asc' } }),
      this.prisma.resumeAnalysis
        .findFirst({ where: { sessionId } })
        .then((row) => row ?? this.prisma.resumeAnalysis.findFirst({
          where: { userId: memory.userId },
          orderBy: { createdAt: 'desc' },
        })),
    ])

    const { entries, source } = this.resolveTranscriptEntries(transcriptRows, memory, notes)

    const interviewMetadata: InterviewMetadataEvidence = {
      sessionId,
      userId: memory.userId || session?.userId || '',
      role: session?.role || memory.role,
      company: session?.company || memory.company,
      difficulty: session?.difficulty || memory.difficulty,
      mode: session?.mode ?? null,
      status: session?.status ?? null,
      candidateName: memory.candidateName || 'Candidate',
      interviewStage: memory.interviewStage,
      startedAt: session?.startedAt ? session.startedAt.toISOString() : null,
      completedAt: session?.completedAt ? session.completedAt.toISOString() : null,
      durationSeconds: session?.durationSeconds ?? null,
    }

    const transcriptStatistics = this.buildTranscriptStatistics(entries, source)
    const qaPairs = this.buildQaPairs(entries)
    const questionsAsked = qaPairs.length
      ? qaPairs.map((pair) => pair.question)
      : this.dedupe(memory.askedQuestions)

    if (!qaPairs.length && memory.askedQuestions.length) {
      notes.push('No question/answer pairs could be derived from transcript entries; falling back to askedQuestions from conversation memory.')
    }

    const unansweredQuestions = qaPairs.filter((pair) => !pair.answer || !pair.answer.trim()).map((pair) => pair.question)

    const communicationEvidence = this.buildCommunicationEvidence(entries)

    const technicalTopics: TechnicalTopicsEvidence = {
      covered: this.dedupe(memory.coveredTopics),
      strong: this.dedupe(memory.strongTopics),
      weak: this.dedupe(memory.weakTopics),
      questionTopics: this.dedupe(memory.questionTopics),
    }

    const resumeContext: ResumeContextEvidence = {
      candidateProfile: memory.candidateProfile ?? null,
      resumeSummary: memory.resumeSummary || '',
      atsScore: resumeRecord?.atsScore ?? null,
      resumeScore: resumeRecord?.resumeScore ?? null,
      extractedSkills: this.toStringArray(resumeRecord?.extractedSkills),
      missingSkills: this.toStringArray(resumeRecord?.missingSkills),
    }

    const confidenceSignals = this.buildConfidenceSignals(memory)
    const coverageMetrics: CoverageMetrics = {
      interviewPlan: memory.interviewPlan,
      planProgress: memory.planProgress,
      questionsAskedTotal: questionsAsked.length,
      questionIndex: memory.questionIndex,
    }

    if (!entries.length) {
      notes.push('No transcript content was available for this session (neither persisted Transcript rows nor buffered recent transcript).')
    }

    return {
      interviewMetadata,
      transcriptStatistics,
      questionsAsked,
      questionsAnswered: qaPairs,
      technicalTopics,
      communicationEvidence,
      strengthsObserved: this.dedupe(memory.candidateStrengths),
      weaknessesObserved: this.dedupe(memory.candidateWeaknesses),
      unansweredQuestions,
      resumeContext,
      confidenceSignals,
      coverageMetrics,
      extractionNotes: notes,
      extractedAt: new Date().toISOString(),
    }
  }

  private resolveTranscriptEntries(
    transcriptRows: Array<{ sequence: number; speaker: string; content: string; createdAt: Date }>,
    memory: ConversationMemory,
    notes: string[],
  ): { entries: EvidenceTranscriptEntry[]; source: EvidenceSource } {
    if (transcriptRows.length) {
      return {
        source: 'transcript_table',
        entries: transcriptRows.map((row) => ({
          sequence: row.sequence,
          speaker: row.speaker as EvidenceTranscriptEntry['speaker'],
          content: row.content,
          at: row.createdAt ? row.createdAt.toISOString() : null,
        })),
      }
    }

    if (memory.recentTranscript.length) {
      notes.push('Persisted Transcript rows were empty for this session; used the buffered recentTranscript from conversation memory (last 40 entries only) instead.')
      return {
        source: 'redis_recent_transcript',
        entries: memory.recentTranscript.map((entry, index) => ({
          sequence: index,
          speaker: entry.speaker as EvidenceTranscriptEntry['speaker'],
          content: entry.content,
          at: entry.at || null,
        })),
      }
    }

    return { source: 'none', entries: [] }
  }

  private buildTranscriptStatistics(entries: EvidenceTranscriptEntry[], source: EvidenceSource): TranscriptStatistics {
    const candidate = entries.filter((e) => e.speaker === 'candidate')
    const interviewer = entries.filter((e) => e.speaker === 'interviewer' || e.speaker === 'ai')
    const system = entries.filter((e) => e.speaker === 'system')

    const candidateWordCounts = candidate.map((e) => this.wordCount(e.content))
    const candidateWordCount = candidateWordCounts.reduce((sum, n) => sum + n, 0)
    const interviewerWordCount = interviewer.reduce((sum, e) => sum + this.wordCount(e.content), 0)

    return {
      source,
      totalEntries: entries.length,
      candidateEntries: candidate.length,
      interviewerEntries: interviewer.length,
      systemEntries: system.length,
      candidateWordCount,
      interviewerWordCount,
      averageCandidateAnswerWordCount: candidate.length
        ? Math.round((candidateWordCount / candidate.length) * 10) / 10
        : 0,
      longestCandidateAnswerWordCount: candidateWordCounts.length ? Math.max(...candidateWordCounts) : 0,
      shortestCandidateAnswerWordCount: candidateWordCounts.length ? Math.min(...candidateWordCounts) : 0,
      firstEntryAt: entries[0]?.at ?? null,
      lastEntryAt: entries[entries.length - 1]?.at ?? null,
    }
  }

  private buildQaPairs(entries: EvidenceTranscriptEntry[]): EvidenceQAPair[] {
    const pairs: EvidenceQAPair[] = []
    let current: EvidenceQAPair | null = null

    for (const entry of entries) {
      const isQuestion = entry.speaker === 'interviewer' || entry.speaker === 'ai'
      const isAnswer = entry.speaker === 'candidate'

      if (isQuestion) {
        if (current) pairs.push(current)
        current = {
          sequence: entry.sequence,
          question: entry.content.trim(),
          askedAt: entry.at,
          answer: null,
          answeredAt: null,
        }
        continue
      }

      if (isAnswer && current) {
        current.answer = current.answer ? `${current.answer} ${entry.content.trim()}` : entry.content.trim()
        current.answeredAt = current.answeredAt || entry.at
      }
    }

    if (current) pairs.push(current)
    return pairs
  }

  private buildCommunicationEvidence(entries: EvidenceTranscriptEntry[]): CommunicationEvidenceEntry[] {
    return entries
      .filter((e) => e.speaker === 'candidate')
      .map((e) => {
        const trimmed = e.content.trim()
        const fillerMatches = trimmed.match(FILLER_WORD_PATTERN) || []
        const sentenceCount = trimmed.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length
        return {
          sequence: e.sequence,
          wordCount: this.wordCount(trimmed),
          fillerWordCount: fillerMatches.length,
          sentenceCount,
          preview: trimmed.slice(0, 160),
        }
      })
  }

  private buildConfidenceSignals(memory: ConversationMemory): ConfidenceSignals {
    const scores = memory.answerScores
    const qualityDistribution: Record<AnswerQuality, number> = { WEAK: 0, AVERAGE: 0, STRONG: 0 }
    for (const score of scores) {
      qualityDistribution[score.quality] += 1
    }

    const avg = (values: number[]): number | null =>
      values.length ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : null

    const perAnswer: ConfidenceSignalEntry[] = scores.map((s) => ({
      scoredAt: s.scoredAt,
      answerPreview: s.answerPreview,
      quality: s.quality,
      technicalDepth: s.technicalDepth,
      communication: s.communication,
      clarity: s.clarity,
      completeness: s.completeness,
      confidence: s.confidence,
      average: s.average,
    }))

    return {
      scoreCount: scores.length,
      averageTechnicalDepth: avg(scores.map((s) => s.technicalDepth)),
      averageCommunication: avg(scores.map((s) => s.communication)),
      averageClarity: avg(scores.map((s) => s.clarity)),
      averageCompleteness: avg(scores.map((s) => s.completeness)),
      averageConfidence: avg(scores.map((s) => s.confidence)),
      averageOverall: avg(scores.map((s) => s.average)),
      qualityDistribution,
      perAnswer,
    }
  }

  private wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
  }

  private dedupe(items: string[]): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of items) {
      const key = item.trim().toLowerCase()
      if (key && !seen.has(key)) {
        seen.add(key)
        out.push(item)
      }
    }
    return out
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
    return []
  }
}
