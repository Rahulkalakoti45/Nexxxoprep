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
  if (typeof question.question !== 'string' || !question.question.trim()) return false
  if (!Array.isArray(question.expectedConcepts) || !Array.isArray(question.followUpTemplates)) return false
  if (!Number.isFinite(question.estimatedTime) || question.estimatedTime <= 0) return false
  return true
}

export function validateSessionShape(session) {
  if (!session || typeof session !== 'object') return false
  const required = [
    'sessionId',
    'company',
    'role',
    'difficulty',
    'interviewMode',
    'rounds',
    'questions',
    'currentRoundIndex',
    'currentQuestionIndex',
    'answers',
    'startedAt',
    'completedAt',
    'progress',
  ]
  if (!required.every((k) => k in session)) return false
  if (!Array.isArray(session.rounds) || !Array.isArray(session.questions)) return false
  if (typeof session.answers !== 'object' || Array.isArray(session.answers)) return false
  return true
}

