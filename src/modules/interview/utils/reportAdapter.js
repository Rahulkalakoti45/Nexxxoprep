function normalizeDomainForAnalytics(question, session) {
  const d = String(question?.domain || '').toLowerCase()
  if (d.includes('system')) return 'System Design'
  if (d === 'dsa') return 'DSA'
  if (d === 'hr') return 'HR'
  if (d === 'behavioral') return 'HR'
  if (d === 'resume' || d === 'project' || d === 'skill') return 'Resume'

  // coding: map to frontend/backend based on role
  if (d === 'coding') {
    const role = String(session?.role || '').toLowerCase()
    if (role.includes('frontend')) return 'Frontend'
    if (role.includes('backend')) return 'Backend'
    return 'Backend'
  }
  return 'General'
}

export function buildAnswerEntriesFromSession(session) {
  const answersMap = session?.answers || {}
  const questions = session?.questions || []

  return questions
    .map((q) => {
      const entry = answersMap[q.id]
      if (!entry) return null
      const analyticsDomain = normalizeDomainForAnalytics(q, session)

      return {
        question: {
          id: q.id,
          question: q.question,
          domain: analyticsDomain,
          roundName: q.round,
          type: q.domain,
          isFollowUp: Boolean(q.isFollowUp),
          expectedKeywords: Array.isArray(q.expectedConcepts) ? q.expectedConcepts : [],
          followUpQuestions: Array.isArray(q.followUpTemplates) ? q.followUpTemplates : [],
        },
        answer: entry.answer || '',
        status: entry.status || 'answered',
        answeredAt: entry.answeredAt,
        timeTakenSeconds: entry.timeTakenSeconds || 0,
        feedback: {
          score: entry.score ?? entry.evaluation?.score ?? 0,
          confidenceScore: entry.evaluation?.confidence === 'high' ? 85 : entry.evaluation?.confidence === 'medium' ? 65 : 45,
          clarityScore: entry.evaluation?.clarity === 'clear' ? 85 : entry.evaluation?.clarity === 'moderate' ? 65 : 45,
          strengths: entry.evaluation?.strengths || [],
          weaknesses: entry.evaluation?.weaknesses || [],
          suggestions: entry.evaluation?.suggestions || [],
          meta: {
            wordCount: entry.evaluation?.meta?.wordCount ?? (entry.answer ? entry.answer.split(/\\s+/).filter(Boolean).length : 0),
            domainTerms: [],
          },
        },
      }
    })
    .filter(Boolean)
}

export function buildTimingFromSession(session, answerEntries) {
  const totalSeconds = Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000))
  const answeredCount = answerEntries.length || 1
  const avg = Math.round(totalSeconds / answeredCount)
  return {
    durationSeconds: totalSeconds,
    timing: { totalSeconds, averageQuestionSeconds: avg },
  }
}

