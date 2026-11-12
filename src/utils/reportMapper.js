function scoreTypeForDomain(domain) {
  const d = String(domain || '').toLowerCase()
  if (d.includes('system')) return 'system_design'
  if (d === 'dsa' || d.includes('coding')) return 'technical'
  if (d === 'hr' || d === 'behavioral') return 'behavioral'
  if (d === 'resume') return 'communication'
  return 'general'
}

export function buildBackendReportPayload(userId, uiReport) {
  const domainBreakdown = uiReport.domainBreakdown || []
  const scores = domainBreakdown.map((item) => ({
    domain: item.domain,
    scoreType: scoreTypeForDomain(item.domain),
    value: item.avgScore ?? 0,
    weight: 1,
    metadata: { answered: item.answered, skipped: item.skipped },
  }))

  if (!scores.length) {
    scores.push({
      domain: 'General',
      scoreType: 'general',
      value: uiReport.overallScore ?? 0,
      weight: 1,
    })
  }

  const roadmap = uiReport.roadmap || {}
  const roadmapSuggestions = []

  const pushRoadmap = (items, category, priority) => {
    for (const title of items || []) {
      roadmapSuggestions.push({
        category,
        priority,
        title: String(title).slice(0, 120),
        description: String(title),
        actions: [String(title)],
      })
    }
  }

  pushRoadmap(roadmap.dailyPlan, 'daily', 2)
  pushRoadmap(roadmap.weeklyGoals, 'weekly', 3)
  pushRoadmap(roadmap.monthlyGoals, 'monthly', 4)

  return {
    userId,
    summary: uiReport.recommendation || `Interview score ${uiReport.overallScore}% (${uiReport.level || 'N/A'})`,
    scores,
    aiFeedback: { uiReport },
    behavioralSummary: {
      patternAnalysis: uiReport.patternAnalysis,
      communicationMetrics: uiReport.communicationMetrics,
      followUpPerformance: uiReport.followUpPerformance,
    },
    roadmapSuggestions,
  }
}

function parseAiFeedback(aiFeedback) {
  if (!aiFeedback) return null
  if (typeof aiFeedback === 'string') {
    try {
      return JSON.parse(aiFeedback)
    } catch {
      return null
    }
  }
  return aiFeedback
}

// Voice interviews are scored by the AI interviewer, not answer by answer, so the numbers below are
// measured from the transcript that was saved with the session instead of being left at zero.
// The definitions follow the classic interview flow (interviewService.computePatternAnalysis).
const HEDGE_PATTERN = /\b(maybe|not sure|i think|i guess)\b/gi
const FILLER_PATTERN = /\b(um+|uh+|like|you know|basically|actually|literally|sort of|kind of)\b/gi

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length
}

/** The question/answer pairs in which the candidate actually said something. */
export function answeredPairs(evidence) {
  const pairs = Array.isArray(evidence?.questionsAnswered) ? evidence.questionsAnswered : []
  return pairs.filter((pair) => pair && typeof pair.answer === 'string' && pair.answer.trim())
}

export function deriveAnswerPatterns(answered) {
  if (!answered.length) {
    return { averageAnswerLength: 0, hesitationScore: 0, consistencyScore: 0, hedgeCount: 0, fillerCount: 0 }
  }
  const lengths = answered.map((pair) => wordCount(pair.answer))
  const averageAnswerLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
  const hesitantAnswers = answered.filter((pair) => countMatches(pair.answer, HEDGE_PATTERN) > 0).length
  return {
    averageAnswerLength,
    hesitationScore: Math.round((hesitantAnswers / answered.length) * 100),
    consistencyScore: Math.max(35, Math.round(90 - Math.min(45, Math.abs(65 - averageAnswerLength) * 0.8))),
    hedgeCount: answered.reduce((sum, pair) => sum + countMatches(pair.answer, HEDGE_PATTERN), 0),
    fillerCount: answered.reduce((sum, pair) => sum + countMatches(pair.answer, FILLER_PATTERN), 0),
  }
}

function offsetSeconds(at, start) {
  const t = Date.parse(at || '')
  const s = Date.parse(start || '')
  if (!Number.isFinite(t) || !Number.isFinite(s)) return null
  return Math.max(0, Math.round((t - s) / 1000))
}

/**
 * One review per answered question: the question, what the candidate said, when it was asked
 * (seconds from the start of the interview) and, when the grounded summary wrote it, coaching
 * with a quote from the answer and a better answer. Without coaching the review still shows the
 * exchange itself, so older reports get something useful too.
 */
export function buildQuestionReviews(evidence, interviewSummary) {
  const answered = answeredPairs(evidence)
  if (!answered.length) return []
  const start = evidence?.transcriptStatistics?.firstEntryAt || evidence?.interviewMetadata?.startedAt || answered[0]?.askedAt
  const feedback = new Map(
    (Array.isArray(interviewSummary?.questionFeedback) ? interviewSummary.questionFeedback : [])
      .filter((row) => row && typeof row.sequence === 'number')
      .map((row) => [row.sequence, row]),
  )
  return answered.map((pair) => {
    const coaching = feedback.get(pair.sequence) || null
    return {
      sequence: pair.sequence,
      question: pair.question,
      answer: pair.answer.trim(),
      askedAtSeconds: offsetSeconds(pair.askedAt, start),
      wordCount: wordCount(pair.answer),
      fillerCount: countMatches(pair.answer, FILLER_PATTERN),
      topic: coaching?.topic || null,
      verdict: coaching?.verdict || null,
      quote: coaching?.quote || null,
      whatWorked: coaching?.whatWorked || '',
      whatWasMissing: coaching?.whatWasMissing || '',
      betterAnswer: coaching?.betterAnswer || '',
    }
  })
}

export function mapBackendReportToUi(report) {
  const feedback = parseAiFeedback(report?.aiFeedback)
  const stored = feedback?.uiReport
  if (stored && typeof stored === 'object') {
    return {
      ...stored,
      id: report.id,
      backendReportId: report.id,
      backendSessionId: report.sessionId,
      createdAt: report.createdAt || stored.createdAt,
      overallScore: report.overallScore ?? stored.overallScore,
    }
  }

  const session = report.session || {}
  // Grounded reports (Evidence Extraction Layer + Gemini, see InterviewSummaryService)
  // store their result as aiFeedback.interviewSummary rather than aiFeedback.uiReport.
  // Surface that real data where the legacy uiReport shape has no equivalent, and leave
  // fields with no grounded equivalent (e.g. per-question `answers`) as empty rather than
  // fabricated.
  const interviewSummary = feedback?.interviewSummary && typeof feedback.interviewSummary === 'object'
    ? feedback.interviewSummary
    : null
  const roadmapRows = Array.isArray(session.roadmap) ? session.roadmap : []
  const scoreRows = Array.isArray(session.scores) ? session.scores : []

  const roadmapItems = roadmapRows.length
    ? roadmapRows.map((row) => row.description || row.title).filter(Boolean)
    : interviewSummary?.recommendations || []

  // The topics the questions fell into, as scored by the evidence-grounded summary; otherwise the
  // stored score rows (minus the overall rating, which is not a domain).
  const summaryDomains = Array.isArray(interviewSummary?.domainScores) ? interviewSummary.domainScores : []
  const domainBreakdown = summaryDomains.length
    ? summaryDomains.map((d) => ({
        domain: d.domain,
        avgScore: Math.round((d.score ?? 0) * 10),
        count: d.questions ?? 1,
      }))
    : scoreRows
        .filter((s) => s.domain !== 'overall')
        .map((s) => ({
          domain: s.domain,
          avgScore: Math.round(s.value ?? 0),
          count: 1,
        }))

  const evidence = session.metadata?.evidence && typeof session.metadata.evidence === 'object' ? session.metadata.evidence : null
  const answered = answeredPairs(evidence)
  const patterns = deriveAnswerPatterns(answered)

  return {
    id: report.id,
    backendReportId: report.id,
    backendSessionId: report.sessionId,
    createdAt: report.createdAt,
    overallScore: report.overallScore ?? 0,
    level: report.overallScore >= 85 ? 'Strong' : report.overallScore >= 70 ? 'Good' : 'Developing',
    recommendation: interviewSummary?.recommendations?.[0] || report.summary || 'Keep practicing.',
    config: {
      role: session.role || 'SDE',
      company: session.company || 'General',
      difficulty: session.difficulty || 'Medium',
    },
    durationSeconds: session.durationSeconds || 0,
    domainBreakdown,
    answers: [],
    questionReviews: buildQuestionReviews(evidence, interviewSummary),
    questionCount: answered.length,
    weaknessSummary: interviewSummary?.weaknesses || [],
    strengthsSummary: interviewSummary?.strengths || [],
    keyTopics: interviewSummary?.keyTopics || [],
    patternAnalysis: {
      averageAnswerLength: patterns.averageAnswerLength,
      hesitationScore: answered.length ? patterns.hesitationScore : (report.hesitationScore ?? 0),
      consistencyScore: patterns.consistencyScore,
    },
    roadmap: { dailyPlan: roadmapItems, weeklyGoals: [], monthlyGoals: [] },
    intelligence: {
      patternAnalysis: {
        hesitationWordsDetected: patterns.hedgeCount,
        fillerWordsDetected: patterns.fillerCount,
        skippedDomains: [],
      },
    },
  }
}

export function mapBackendReportsList(reports) {
  return (reports || []).map(mapBackendReportToUi)
}

/**
 * Reshape a full session record (as returned by GET /api/sessions/:sessionId,
 * which includes `feedbackReport`, `roadmap`, and `scores`) into the same
 * report-shaped object mapBackendReportToUi expects, then map it. Returns
 * null when the session has no feedback report yet (e.g. still in progress),
 * so callers can render a "not found / not ready" state instead of a broken UI.
 */
export function mapSessionToReport(session) {
  if (!session || !session.feedbackReport) return null
  return {
    ...mapBackendReportToUi({
      ...session.feedbackReport,
      session,
    }),
    behavior: mapBehaviorReport(session.metadata?.behaviorReport),
  }
}

/**
 * Normalises session.metadata.behaviorReport for the report page. Two writers fill that slot:
 * the in-browser analysis (source 'browser', with a full aggregation) and the server-side
 * Python engine (a pointer plus four headline numbers). Returns null when nothing was measured.
 */
export function mapBehaviorReport(raw) {
  if (!raw || typeof raw !== 'object') return null
  const aggregation = raw.aggregation && typeof raw.aggregation === 'object' ? raw.aggregation : null
  const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

  const overall = num(raw.behaviorScore ?? aggregation?.avgScores?.overall)
  const engagement = num(raw.engagementScore ?? aggregation?.avgScores?.engagement)
  const attention = num(raw.attentionScore ?? aggregation?.avgScores?.attention)
  if (overall === null && engagement === null && attention === null) return null

  return {
    source: raw.source === 'browser' ? 'browser' : 'engine',
    // The browser analysis saves progress as it goes; without a final save the numbers cover
    // only the part of the interview that was captured.
    partial: raw.source === 'browser' && !raw.finalizedAt,
    overall,
    engagement,
    attention,
    warningCount: num(raw.warningCount ?? aggregation?.totalEvents),
    durationSeconds: num(aggregation?.durationSeconds),
    scores: aggregation?.avgScores ?? null,
    percentages: aggregation?.percentages ?? null,
    gestureObserved: aggregation?.gestureObserved ?? true,
    strongestSignal: aggregation?.strongestSignal ?? null,
    weakestSignal: aggregation?.weakestSignal ?? null,
    trends: aggregation?.trends ?? null,
    events: Array.isArray(aggregation?.events) ? aggregation.events : [],
  }
}
