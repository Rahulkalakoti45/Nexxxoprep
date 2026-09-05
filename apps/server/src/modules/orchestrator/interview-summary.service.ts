import type { AnswerScore, InterviewEvidence, InterviewSummary } from '@nexoprep/types'
import type { ConversationMemory } from '../conversation/memory.service.js'
import { GeminiService } from './gemini.service.js'

const NOT_EVALUATED = 'Not Evaluated'
const INSUFFICIENT_EVIDENCE = 'Insufficient Evidence'

/**
 * System prompt for evidence-grounded report generation.
 *
 * Gemini's role here is a REPORT WRITER, not an evaluator: it may only
 * narrate and structure what the Evidence Extraction Layer already observed.
 * It must never introduce a technology, algorithm, framework, tool, or skill
 * that isn't already present in the supplied evidence, and must never infer
 * content from role/company/difficulty alone.
 */
const EVIDENCE_GROUNDED_SYSTEM_PROMPT = `You are a professional interview evaluator.

You are provided with structured interview evidence.

Use ONLY the supplied evidence.

Do NOT infer technologies, algorithms, frameworks, tools or skills that do not appear in the evidence.

Do NOT infer from:
- role
- company
- interview difficulty

If evidence is missing, explicitly write "${NOT_EVALUATED}" instead of guessing.

If the interview was too short, state that there was insufficient evidence.

Never invent strengths.

Never invent weaknesses.

Never invent recommendations.

Recommendations must directly correspond to observed weaknesses.

Strengths must directly correspond to observed evidence.`

export class InterviewSummaryService {
  constructor(private readonly gemini: GeminiService) {}

  /**
   * Deterministic, evidence-only fallback summary. Used when Gemini is not
   * configured, when evidence coverage is too thin to responsibly evaluate,
   * or if the grounded Gemini call fails for any reason.
   */
  buildHeuristicSummary(memory: ConversationMemory, evidence: InterviewEvidence | null): InterviewSummary {
    const avgScore =
      memory.answerScores.length > 0
        ? memory.answerScores.reduce((sum, s) => sum + s.average, 0) / memory.answerScores.length
        : 0

    if (!evidence || this.isInsufficientEvidence(evidence)) {
      return {
        strengths: [INSUFFICIENT_EVIDENCE],
        weaknesses: [INSUFFICIENT_EVIDENCE],
        keyTopics: [INSUFFICIENT_EVIDENCE],
        recommendations: [`${INSUFFICIENT_EVIDENCE}: interview was too short to generate reliable recommendations.`],
        overallRating: Math.round(avgScore * 10) / 10,
        generatedAt: new Date().toISOString(),
      }
    }

    return {
      strengths: evidence.strengthsObserved.length ? evidence.strengthsObserved.slice(0, 5) : [NOT_EVALUATED],
      weaknesses: evidence.weaknessesObserved.length ? evidence.weaknessesObserved.slice(0, 5) : [NOT_EVALUATED],
      keyTopics: evidence.technicalTopics.covered.length ? evidence.technicalTopics.covered.slice(0, 10) : [NOT_EVALUATED],
      recommendations: this.buildRecommendations(evidence),
      overallRating: Math.round(avgScore * 10) / 10,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Generate the interview summary. `evidence` is the InterviewEvidence object
   * produced by EvidenceExtractionService for this session — it is NOT
   * regenerated here, only consumed. Gemini is asked to write the report
   * strictly from that evidence; it is never handed raw memory/role/company
   * as a substitute for evidence.
   */
  async generateSummary(memory: ConversationMemory, evidence: InterviewEvidence | null): Promise<InterviewSummary> {
    const heuristic = this.buildHeuristicSummary(memory, evidence)
    if (!this.gemini.isConfigured()) return heuristic
    if (!evidence || this.isInsufficientEvidence(evidence)) return heuristic

    try {
      const userPrompt = this.buildEvidencePrompt(evidence)
      const raw = await this.gemini.generateText(EVIDENCE_GROUNDED_SYSTEM_PROMPT, userPrompt)
      const parsed = JSON.parse(raw) as Partial<InterviewSummary>
      return this.groundAgainstEvidence(parsed, evidence, heuristic)
    } catch {
      return heuristic
    }
  }

  toReportPayload(summary: InterviewSummary, scores: AnswerScore[]) {
    const latest = scores[scores.length - 1]
    return {
      summary: [
        `Overall rating: ${summary.overallRating}/10`,
        `Strengths: ${summary.strengths.join('; ') || 'N/A'}`,
        `Weaknesses: ${summary.weaknesses.join('; ') || 'N/A'}`,
        `Key topics: ${summary.keyTopics.join('; ') || 'N/A'}`,
        `Recommendations: ${summary.recommendations.join('; ') || 'N/A'}`,
      ].join('\n'),
      aiFeedback: {
        interviewSummary: summary,
        latestAnswerScore: latest || null,
      },
      behavioralSummary: {
        strongTopics: summary.strengths,
        weakTopics: summary.weaknesses,
      },
      scores: this.toScoreInputs(scores, summary.overallRating),
    }
  }

  /**
   * An interview only has enough evidence to evaluate if the transcript
   * actually produced at least one answered question. Anything short of
   * that must be reported as insufficient rather than evaluated.
   */
  private isInsufficientEvidence(evidence: InterviewEvidence): boolean {
    if (evidence.transcriptStatistics.totalEntries === 0) return true
    const answeredCount = evidence.questionsAnswered.filter((pair) => pair.answer && pair.answer.trim().length > 0).length
    return answeredCount === 0
  }

  private buildEvidencePrompt(evidence: InterviewEvidence): string {
    // Only the fields relevant to writing the report are sent — no session/user
    // identifiers — but every piece of transcript-derived content (questions,
    // answers, observed strengths/weaknesses/topics) is included verbatim so
    // Gemini has the actual evidence rather than a paraphrase of it.
    const evidenceForPrompt = {
      role: evidence.interviewMetadata.role,
      company: evidence.interviewMetadata.company,
      difficulty: evidence.interviewMetadata.difficulty,
      transcriptStatistics: evidence.transcriptStatistics,
      questionsAnswered: evidence.questionsAnswered,
      unansweredQuestions: evidence.unansweredQuestions,
      technicalTopics: evidence.technicalTopics,
      communicationEvidence: evidence.communicationEvidence,
      strengthsObserved: evidence.strengthsObserved,
      weaknessesObserved: evidence.weaknessesObserved,
      resumeContext: evidence.resumeContext,
      confidenceSignals: evidence.confidenceSignals,
      coverageMetrics: evidence.coverageMetrics,
      extractionNotes: evidence.extractionNotes,
    }

    return [
      'Below is the complete structured interview evidence for this session. This is the ONLY information you may use.',
      JSON.stringify(evidenceForPrompt),
      '',
      `Remember: role, company, and difficulty above are context only — never a basis for inferring skills. Any technology, algorithm, framework, or tool you mention must appear in technicalTopics, resumeContext, questionsAnswered, or communicationEvidence above. If a category has no supporting evidence, write "${NOT_EVALUATED}" for it.`,
      'Return ONLY valid JSON with keys: strengths (string[]), weaknesses (string[]), keyTopics (string[]), recommendations (string[]), overallRating (number 0-10).',
    ].join('\n')
  }

  /**
   * Defense in depth: even with explicit prompt instructions, an LLM can
   * still hallucinate. keyTopics is the field most directly about
   * technologies/algorithms/frameworks, so it is checked against the actual
   * evidence vocabulary and anything unsupported is dropped. Every other
   * field falls back to the evidence-only heuristic whenever Gemini returns
   * nothing usable for it.
   */
  private groundAgainstEvidence(
    parsed: Partial<InterviewSummary>,
    evidence: InterviewEvidence,
    heuristic: InterviewSummary,
  ): InterviewSummary {
    const vocabulary = this.buildEvidenceVocabulary(evidence)
    const groundedKeyTopics = this.filterToVocabulary(parsed.keyTopics, vocabulary)

    return {
      strengths: parsed.strengths?.length ? parsed.strengths : heuristic.strengths,
      weaknesses: parsed.weaknesses?.length ? parsed.weaknesses : heuristic.weaknesses,
      keyTopics: groundedKeyTopics.length ? groundedKeyTopics : heuristic.keyTopics,
      recommendations: parsed.recommendations?.length ? parsed.recommendations : heuristic.recommendations,
      overallRating: typeof parsed.overallRating === 'number' ? parsed.overallRating : heuristic.overallRating,
      generatedAt: new Date().toISOString(),
    }
  }

  private buildEvidenceVocabulary(evidence: InterviewEvidence): Set<string> {
    const terms = [
      ...evidence.technicalTopics.covered,
      ...evidence.technicalTopics.strong,
      ...evidence.technicalTopics.weak,
      ...evidence.technicalTopics.questionTopics,
      ...evidence.resumeContext.extractedSkills,
      ...evidence.resumeContext.missingSkills,
    ]
    return new Set(terms.map((term) => term.toLowerCase().trim()).filter(Boolean))
  }

  private filterToVocabulary(topics: string[] | undefined, vocabulary: Set<string>): string[] {
    if (!topics?.length || vocabulary.size === 0) return []
    return topics.filter((topic) => {
      const normalized = topic.toLowerCase().trim()
      if (!normalized) return false
      if (vocabulary.has(normalized)) return true
      for (const term of vocabulary) {
        if (term.length > 2 && (normalized.includes(term) || term.includes(normalized))) return true
      }
      return false
    })
  }

  private toScoreInputs(scores: AnswerScore[], overallRating: number) {
    if (!scores.length) {
      return [
        { domain: 'overall', scoreType: 'interview_rating', value: overallRating, weight: 1 },
      ]
    }

    const latest = scores[scores.length - 1] as AnswerScore
    return [
      { domain: 'overall', scoreType: 'interview_rating', value: overallRating, weight: 1 },
      { domain: 'technical', scoreType: 'technical_depth', value: latest.technicalDepth, weight: 1 },
      { domain: 'communication', scoreType: 'communication', value: latest.communication, weight: 1 },
      { domain: 'communication', scoreType: 'clarity', value: latest.clarity, weight: 1 },
      { domain: 'technical', scoreType: 'completeness', value: latest.completeness, weight: 1 },
      { domain: 'confidence', scoreType: 'confidence', value: latest.confidence, weight: 1 },
    ]
  }

  private buildRecommendations(evidence: InterviewEvidence): string[] {
    const recs: string[] = []
    if (evidence.technicalTopics.weak.length) {
      recs.push(`Review and practice: ${evidence.technicalTopics.weak.slice(0, 3).join(', ')}`)
    }
    if (evidence.weaknessesObserved.length) {
      recs.push(`Improve: ${evidence.weaknessesObserved.slice(0, 2).join('; ')}`)
    }
    if (!recs.length) recs.push(NOT_EVALUATED)
    return recs.slice(0, 5)
  }
}
