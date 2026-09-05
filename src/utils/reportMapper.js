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

  const domainBreakdown = scoreRows.map((s) => ({
    domain: s.domain,
    avgScore: Math.round(s.value ?? 0),
    count: 1,
  }))

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
    weaknessSummary: interviewSummary?.weaknesses || [],
    strengthsSummary: interviewSummary?.strengths || [],
    keyTopics: interviewSummary?.keyTopics || [],
    patternAnalysis: {
      averageAnswerLength: 0,
      hesitationScore: report.hesitationScore ?? 0,
      consistencyScore: 0,
    },
    roadmap: { dailyPlan: roadmapItems, weeklyGoals: [], monthlyGoals: [] },
    intelligence: {},
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
  return mapBackendReportToUi({
    ...session.feedbackReport,
    session,
  })
}
