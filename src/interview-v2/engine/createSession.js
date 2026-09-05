import { getCompanyRoundFlow, getSafeFallbackRounds } from './companyRoundEngine'
import { getCompanyQuestions, getFallbackQuestions } from './questionEngine'
import { mapQuestionsToRounds } from '../utils/questionHelpers'
import { isValidQuestion, validateSessionShape } from '../utils/validators'

function createSafeSessionSkeleton(company, role) {
  return {
    sessionId: crypto.randomUUID(),
    company,
    role,
    currentRoundIndex: 0,
    currentQuestionIndex: 0,
    rounds: [],
    questions: [],
    answers: {},
    progress: { answered: 0, total: 0, percent: 0 },
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'in_progress',
    errors: [],
    followUpAskedFor: {},
  }
}

export function createSession({ company = 'amazon', role = 'SDE' } = {}) {
  const normalizedCompany = String(company).trim().toLowerCase()
  const session = createSafeSessionSkeleton(normalizedCompany, role)

  try {
    const rounds = getCompanyRoundFlow(normalizedCompany)
    const safeRounds = rounds.length ? rounds : getSafeFallbackRounds()

    let questions = getCompanyQuestions({ company: normalizedCompany, role, rounds: safeRounds })
    questions = questions.filter(isValidQuestion)

    if (!questions.length) {
      questions = getFallbackQuestions({ company: normalizedCompany, role, rounds: safeRounds })
    }

    const roundMapped = mapQuestionsToRounds(safeRounds, questions)
    const sessionCandidate = {
      ...session,
      rounds: roundMapped,
      questions,
      progress: { answered: 0, total: questions.length, percent: 0 },
    }

    if (!validateSessionShape(sessionCandidate) || !questions.length) {
      throw new Error('Session validation failed')
    }

    return sessionCandidate
  } catch (error) {
    const fallbackRounds = getSafeFallbackRounds()
    const fallbackQuestions = getFallbackQuestions({ company: normalizedCompany, role, rounds: fallbackRounds })
    return {
      ...session,
      rounds: mapQuestionsToRounds(fallbackRounds, fallbackQuestions),
      questions: fallbackQuestions,
      progress: { answered: 0, total: fallbackQuestions.length, percent: 0 },
      errors: [error instanceof Error ? error.message : 'Unknown session creation error'],
    }
  }
}
