const KEY = 'nexoprep_interview_v1'
const VERSION = 1

function isSafeArray(value) {
  return Array.isArray(value)
}

function isValidSessionShape(session) {
  return (
    session &&
    typeof session === 'object' &&
    typeof session.sessionId === 'string' &&
    typeof session.company === 'string' &&
    typeof session.role === 'string' &&
    isSafeArray(session.rounds) &&
    isSafeArray(session.questions) &&
    Number.isInteger(session.currentQuestionIndex) &&
    Number.isInteger(session.currentRoundIndex) &&
    isSafeArray(session.answers)
  )
}

export function loadInterviewSession() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== VERSION || !isValidSessionShape(parsed?.data)) {
      localStorage.removeItem(KEY)
      return null
    }
    return parsed.data
  } catch {
    localStorage.removeItem(KEY)
    return null
  }
}

export function saveInterviewSession(session) {
  if (!isValidSessionShape(session)) return
  localStorage.setItem(KEY, JSON.stringify({ version: VERSION, data: session }))
}

export function clearInterviewSession() {
  localStorage.removeItem(KEY)
}
