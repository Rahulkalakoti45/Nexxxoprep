export function getCurrentQuestion(session) {
  const questions = Array.isArray(session?.questions)
    ? session.questions
    : Array.isArray(session?.flattenedQuestions)
      ? session.flattenedQuestions
      : []
  const index = Number.isInteger(session?.currentQuestionIndex) ? session.currentQuestionIndex : 0
  return questions[index] || questions[0] || null
}

export function getRoundIndex(session, question) {
  const rounds = Array.isArray(session?.rounds) ? session.rounds : []
  const idx = rounds.findIndex((r) => r.roundName === question?.roundName)
  return Math.max(0, idx)
}

export function getProgress(session) {
  const total = Array.isArray(session?.questions) ? session.questions.length : 0
  const answered = Array.isArray(session?.answers) ? session.answers.length : 0
  if (!total) return 0
  return Math.min(100, Math.round((answered / total) * 100))
}
