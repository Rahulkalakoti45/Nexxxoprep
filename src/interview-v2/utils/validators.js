const REQUIRED_QUESTION_FIELDS = [
  'id',
  'company',
  'role',
  'round',
  'domain',
  'difficulty',
  'question',
  'expectedConcepts',
  'followUpTemplates',
  'estimatedTime',
]

export function isValidQuestion(question) {
  if (!question || typeof question !== 'object') return false
  const hasFields = REQUIRED_QUESTION_FIELDS.every((field) => field in question)
  if (!hasFields) return false
  if (!Array.isArray(question.expectedConcepts) || !Array.isArray(question.followUpTemplates)) return false
  if (typeof question.question !== 'string' || !question.question.trim()) return false
  return Number.isFinite(question.estimatedTime) && question.estimatedTime > 0
}

export function validateSessionShape(session) {
  if (!session || typeof session !== 'object') return false
  const requiredTopLevel = [
    'sessionId',
    'company',
    'role',
    'currentRoundIndex',
    'currentQuestionIndex',
    'rounds',
    'questions',
    'answers',
    'progress',
    'startedAt',
    'completedAt',
    'status',
  ]
  const hasTopLevel = requiredTopLevel.every((field) => field in session)
  if (!hasTopLevel) return false
  if (!Array.isArray(session.rounds) || !Array.isArray(session.questions) || typeof session.answers !== 'object') {
    return false
  }
  return true
}
