function buildSafeQuestion(base, id, text, difficulty) {
  return {
    id,
    company: base.company || 'General',
    role: base.role || 'SDE',
    round: base.round || base.roundName || 'General',
    roundName: base.roundName || base.round || 'General',
    domain: base.domain || 'Behavioral',
    difficulty,
    type: 'follow-up',
    question: text,
    expectedConcepts: Array.isArray(base.expectedConcepts) ? base.expectedConcepts : [],
    followUpTemplates: [],
    estimatedTime: 90,
    isFollowUp: true,
    parentQuestionId: base.id,
  }
}

export function generateFollowUp({ question, feedback, followUpCount = 0 }) {
  if (!question || question.isFollowUp || followUpCount >= 1) return null

  const score = Number.isFinite(feedback?.score) ? feedback.score : 0
  const templates = Array.isArray(question.followUpTemplates) ? question.followUpTemplates : []

  if (score <= 58) {
    const weakPrompt = templates[0] || 'Give a simpler explanation of your approach with one concrete example.'
    return buildSafeQuestion(question, `${question.id}-clarify`, weakPrompt, 'Easy')
  }

  if (score >= 84) {
    const strongPrompt =
      templates[1] || `Good answer. Go deeper: discuss one failure mode and your mitigation plan.`
    return buildSafeQuestion(question, `${question.id}-deepen`, strongPrompt, 'Hard')
  }

  return null
}
