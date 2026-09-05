export function shouldFollowUp({ answer = '', evaluation }) {
  if (!answer.trim()) return true
  if (!evaluation) return false
  return evaluation.score < 45 || evaluation.score > 88
}

export function buildFollowUp(question, evaluation) {
  const template = question?.followUpTemplates?.[0] || 'Can you be more specific with one concrete example?'
  const prefix = evaluation?.score > 88 ? 'Good. Let us go deeper:' : 'Let us strengthen that:'
  return {
    ...question,
    id: `${question.id}-followup`,
    isFollowUp: true,
    parentQuestionId: question.id,
    question: `${prefix} ${template}`,
    estimatedTime: Math.min(120, question.estimatedTime || 120),
  }
}

