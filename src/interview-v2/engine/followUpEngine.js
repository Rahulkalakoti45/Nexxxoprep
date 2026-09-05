export function shouldTriggerFollowUp({ answer = '', evaluation }) {
  if (!answer.trim()) return true
  if (!evaluation) return false
  return evaluation.score < 45 || evaluation.score > 88
}

export function createFollowUpQuestion(question, answer, evaluation) {
  if (!question) return null
  const template = question.followUpTemplates?.[0] || 'Can you elaborate with more specifics?'
  const promptPrefix = evaluation?.score < 45 ? 'Let us strengthen that answer:' : 'Good answer. Let us go deeper:'
  return {
    ...question,
    id: `${question.id}-followup`,
    question: `${promptPrefix} ${template}`,
    isFollowUp: true,
    parentQuestionId: question.id,
    sourceAnswer: answer,
    estimatedTime: Math.min(120, question.estimatedTime),
  }
}
