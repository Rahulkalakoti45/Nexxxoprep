import { getCompanyRounds } from './companyRoundEngine'
import { selectQuestions } from './questionSelector'
import { mapRounds } from '../utils/questionHelpers'
import { isValidQuestion, validateSessionShape } from '../utils/validators'

function safeUUID() {
  try {
    return crypto.randomUUID()
  } catch (_e) {
    return `sess-${Date.now()}-${Math.floor(Math.random() * 100000)}`
  }
}

function skeleton({ company, role, interviewMode }) {
  return {
    sessionId: safeUUID(),
    company,
    role,
    difficulty: 'Medium',
    interviewMode,
    rounds: [],
    questions: [],
    currentRoundIndex: 0,
    currentQuestionIndex: 0,
    answers: {},
    startedAt: new Date().toISOString(),
    completedAt: null,
    progress: { answered: 0, total: 0, percent: 0 },
    errors: [],
    followUpAskedFor: {},
    timers: {
      interviewStartedAt: Date.now(),
      roundStartedAt: Date.now(),
      questionStartedAt: Date.now(),
    },
  }
}

function deriveProgress(answers, total) {
  const answered = Object.keys(answers).length
  return { answered, total, percent: total ? Math.round((answered / total) * 100) : 0 }
}

export function createInterviewSession({
  company = 'Amazon',
  role = 'SDE',
  difficulty = 'Medium',
  interviewMode = 'standard',
  resume = null,
} = {}) {
  const session = { ...skeleton({ company, role, interviewMode }), difficulty }

  try {
    const rounds = getCompanyRounds(company)
    const questions = selectQuestions({ company, role, difficulty, rounds, resume }).filter(isValidQuestion)
    const mappedRounds = mapRounds(rounds, questions)

    const candidate = {
      ...session,
      rounds: mappedRounds,
      questions,
      progress: deriveProgress({}, questions.length),
    }

    if (!validateSessionShape(candidate) || !questions.length) throw new Error('Invalid session')
    return candidate
  } catch (e) {
    const fallbackRounds = getCompanyRounds('fallback')
    const fallbackQuestions = selectQuestions({
      company: company || 'Amazon',
      role: role || 'SDE',
      difficulty,
      rounds: fallbackRounds,
      resume: null,
    }).filter(isValidQuestion)

    return {
      ...session,
      rounds: mapRounds(fallbackRounds, fallbackQuestions),
      questions: fallbackQuestions,
      progress: deriveProgress({}, fallbackQuestions.length),
      errors: [e instanceof Error ? e.message : 'Unknown session error'],
    }
  }
}

