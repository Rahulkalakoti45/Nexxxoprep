import type {
  AnswerScore,
  InterviewEvidence,
  InterviewSummary,
  SummaryDimensionScores,
  SummaryDomainScore,
} from '@nexoprep/types'
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

/** Gemini sometimes wraps its JSON in a markdown fence or adds a sentence around it. */
export function parseJsonObject(raw: string): Record<string, unknown> {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch (error) {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) throw error
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  }
}

/** A number (or numeric string) clamped to 0-10 with one decimal, or null when it is not a number. */
export function clampScore(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  if (!Number.isFinite(n)) return null
  return Math.round(Math.min(Math.max(n, 0), 10) * 10) / 10
}

export function parseDimensionScores(parsed: Record<string, unknown>): SummaryDimensionScores | undefined {
  const technical = clampScore(parsed.technicalScore)
  const communication = clampScore(parsed.communicationScore)
  const confidence = clampScore(parsed.confidenceScore)
  if (technical === null || communication === null || confidence === null) return undefined
  return { technical, communication, confidence }
}

export function parseDomainScores(value: unknown): SummaryDomainScore[] | undefined {
  if (!Array.isArray(value)) return undefined
  const rows: SummaryDomainScore[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const { domain, score, questions } = item as Record<string, unknown>
    const label = typeof domain === 'string' ? domain.trim().slice(0, 40) : ''
    const parsedScore = clampScore(score)
    if (!label || parsedScore === null) continue
    const count = typeof questions === 'number' && Number.isFinite(questions) ? Math.max(1, Math.round(questions)) : 1
    rows.push({ domain: label, score: parsedScore, questions: count })
  }
  return rows.length ? rows.slice(0, 8) : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
}

/** Report scores are stored on a 0-100 scale (the report page shows them as percentages). */
const toPercent = (rating: number): number => Math.round(Math.min(Math.max(rating, 0), 10) * 10)

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
      const parsed = parseJsonObject(raw)
      return this.groundAgainstEvidence(parsed, evidence, heuristic)
    } catch (error) {
      // Falling back is deliberate (a report must still be stored), but never silently:
      // an unexplained "Not Evaluated" report is impossible to diagnose.
      console.error('[SUMMARY] grounded Gemini summary failed; using the evidence-only fallback', error)
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
      scores: this.toScoreInputs(scores, summary),
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
      '',
      "Scoring rules. Every score is a number from 0 to 10 and is judged ONLY from the candidate's actual answers in questionsAnswered:",
      '- technicalScore: correctness and depth of the technical content in the answers.',
      '- communicationScore: clarity, structure and completeness of the answers.',
      "- confidenceScore: how assured the delivery is; many filler words (communicationEvidence.fillerWordCount) or \"I don't know\" answers lower it.",
      '- overallRating: your overall judgement of the interview.',
      '- domainScores: group the ANSWERED questions by topic using short labels such as "Resume & Projects", "Frontend" or "Behavioral", and give each group a score and the number of answered questions in it.',
      'A candidate who did not answer, or who said they did not know, must receive a low score for that topic, never a missing one.',
      '',
      'Return ONLY valid JSON with keys: strengths (string[]), weaknesses (string[]), keyTopics (string[]), recommendations (string[]), overallRating (number 0-10), technicalScore (number 0-10), communicationScore (number 0-10), confidenceScore (number 0-10), domainScores (array of {"domain": string, "score": number 0-10, "questions": integer}).',
    ].join('\n')
  }

  /**
   * Defense in depth: even with explicit prompt instructions, an LLM can
   * still hallucinate. keyTopics is the field most directly about
   * technologies/algorithms/frameworks, so it is checked against the actual
   * evidence (skills, topics and the words of the interview itself) and
   * anything unsupported is dropped. Every other field falls back to the
   * evidence-only heuristic whenever Gemini returns nothing usable for it.
   */
  groundAgainstEvidence(
    parsed: Record<string, unknown>,
    evidence: InterviewEvidence,
    heuristic: InterviewSummary,
  ): InterviewSummary {
    const vocabulary = this.buildEvidenceVocabulary(evidence)
    const evidenceText = this.buildEvidenceText(evidence)
    const groundedKeyTopics = this.filterToEvidence(asStringArray(parsed.keyTopics), vocabulary, evidenceText)
    const strengths = asStringArray(parsed.strengths)
    const weaknesses = asStringArray(parsed.weaknesses)
    const recommendations = asStringArray(parsed.recommendations)

    const summary: InterviewSummary = {
      strengths: strengths.length ? strengths : heuristic.strengths,
      weaknesses: weaknesses.length ? weaknesses : heuristic.weaknesses,
      keyTopics: groundedKeyTopics.length ? groundedKeyTopics : heuristic.keyTopics,
      recommendations: recommendations.length ? recommendations : heuristic.recommendations,
      overallRating: clampScore(parsed.overallRating) ?? heuristic.overallRating,
      generatedAt: new Date().toISOString(),
    }
    const dimensionScores = parseDimensionScores(parsed)
    if (dimensionScores) summary.dimensionScores = dimensionScores
    const domainScores = parseDomainScores(parsed.domainScores)
    if (domainScores) summary.domainScores = domainScores
    return summary
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

  /** Everything said in the interview, lower-cased: what a topic must be traceable to. */
  private buildEvidenceText(evidence: InterviewEvidence): string {
    return evidence.questionsAnswered
      .flatMap((pair) => [pair.question, pair.answer ?? ''])
      .join('\n')
      .toLowerCase()
  }

  private filterToEvidence(topics: string[], vocabulary: Set<string>, evidenceText: string): string[] {
    return topics.filter((topic) => {
      const normalized = topic.toLowerCase().trim()
      if (!normalized) return false
      if (vocabulary.has(normalized)) return true
      for (const term of vocabulary) {
        if (term.length > 2 && (normalized.includes(term) || term.includes(normalized))) return true
      }
      // Voice interviews have no pre-computed topic lists, so a topic is also grounded when it
      // was actually spoken: either verbatim or with every one of its words appearing. An
      // acronym added in brackets, as in "Client-Side Rendering (CSR)", is not held against it.
      if (evidenceText.includes(normalized)) return true
      const spoken = normalized.replace(/\([^)]*\)/g, ' ')
      const words = spoken.match(/[a-z0-9+#.]+/g)?.filter((word) => word.length > 2) ?? []
      return words.length > 0 && words.every((word) => evidenceText.includes(word))
    })
  }

  /** Scores are rated 0-10 internally and stored 0-100, the scale the report page displays. */
  private toScoreInputs(scores: AnswerScore[], summary: InterviewSummary) {
    const overall = { domain: 'overall', scoreType: 'interview_rating', value: toPercent(summary.overallRating), weight: 1 }

    if (!scores.length) {
      // No per-answer scoring happened during the interview (voice interviews run entirely on
      // ElevenLabs), so the dimension ratings come from the transcript evaluation instead.
      const dimensions = summary.dimensionScores
      if (!dimensions) return [overall]
      return [
        overall,
        { domain: 'technical', scoreType: 'technical_depth', value: toPercent(dimensions.technical), weight: 1 },
        { domain: 'communication', scoreType: 'communication', value: toPercent(dimensions.communication), weight: 1 },
        { domain: 'confidence', scoreType: 'confidence', value: toPercent(dimensions.confidence), weight: 1 },
      ]
    }

    const latest = scores[scores.length - 1] as AnswerScore
    return [
      overall,
      { domain: 'technical', scoreType: 'technical_depth', value: toPercent(latest.technicalDepth), weight: 1 },
      { domain: 'communication', scoreType: 'communication', value: toPercent(latest.communication), weight: 1 },
      { domain: 'communication', scoreType: 'clarity', value: toPercent(latest.clarity), weight: 1 },
      { domain: 'technical', scoreType: 'completeness', value: toPercent(latest.completeness), weight: 1 },
      { domain: 'confidence', scoreType: 'confidence', value: toPercent(latest.confidence), weight: 1 },
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
