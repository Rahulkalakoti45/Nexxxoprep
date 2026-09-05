import { generateFallbackQuestions } from './fallbackQuestions.js'

export const fallbackQuestion = {
  id: 'fallback',
  question: 'Tell me about yourself.',
  domain: 'Behavioral',
  round: 'Introduction',
  roundName: 'Introduction',
  type: 'behavioral',
  difficulty: 'Easy',
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

export function isValidQuestion(q) {
  return (
    isObject(q) &&
    typeof q.id !== 'undefined' &&
    typeof q.question === 'string' &&
    q.question.trim().length > 0 &&
    typeof (q.domain || '') === 'string' &&
    typeof (q.round || q.roundName || '') === 'string'
  )
}

function normalizeQuestion(q, index = 0) {
  if (!isValidQuestion(q)) {
    return { ...fallbackQuestion, id: `fallback-${index}` }
  }
  return {
    ...q,
    round: q.round || q.roundName || 'General',
    roundName: q.roundName || q.round || 'General',
    type: q.type || 'behavioral',
    difficulty: q.difficulty || 'Easy',
  }
}

function normalizeRounds(rounds) {
  if (!Array.isArray(rounds)) return []
  return rounds
    .filter((round) => isObject(round))
    .map((round, roundIndex) => {
      const roundName = round.roundName || round.title || `Round ${roundIndex + 1}`
      const questions = Array.isArray(round.questions) ? round.questions.map((q, idx) => normalizeQuestion({ ...q, roundName }, idx)) : []
      return {
        ...round,
        roundName,
        questions,
      }
    })
}

function flattenFromRounds(rounds) {
  return rounds.flatMap((round) =>
    (Array.isArray(round.questions) ? round.questions : []).map((q, idx) =>
      normalizeQuestion(
        {
          ...q,
          round: q.round || round.roundName,
          roundName: q.roundName || round.roundName,
        },
        idx,
      ),
    ),
  )
}

export function createInterviewSession(input = {}) {
  const config = isObject(input.config) ? input.config : { role: 'SDE', company: 'General', difficulty: 'Medium', mode: 'standard' }
  const normalizedRounds = normalizeRounds(input.rounds)
  const candidateFlat = Array.isArray(input.questions)
    ? input.questions.map((q, idx) => normalizeQuestion(q, idx))
    : flattenFromRounds(normalizedRounds)

  const fallbackQuestions = generateFallbackQuestions().map((q, idx) => normalizeQuestion(q, idx))
  const flattenedQuestions = candidateFlat.length ? candidateFlat : fallbackQuestions

  const rounds =
    normalizedRounds.length > 0
      ? normalizedRounds
      : [
          {
            roundName: 'Fallback Round',
            questions: flattenedQuestions,
          },
        ]

  const currentQuestionIndex =
    Number.isInteger(input.currentQuestionIndex) && input.currentQuestionIndex >= 0
      ? Math.min(input.currentQuestionIndex, Math.max(0, flattenedQuestions.length - 1))
      : 0

  const currentRoundName = flattenedQuestions[currentQuestionIndex]?.roundName || rounds[0]?.roundName || 'Fallback Round'
  const currentRoundIndex = Math.max(0, rounds.findIndex((round) => round.roundName === currentRoundName))

  return {
    config,
    rounds,
    flattenedQuestions,
    currentRoundIndex,
    currentQuestionIndex,
  }
}

