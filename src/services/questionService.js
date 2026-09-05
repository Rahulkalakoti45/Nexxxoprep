import { createInterviewSession } from '../interview/engine/createInterviewSession.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getQuestionsByConfig(config) {
  await delay(200)
  const session = createInterviewSession(config || {})
  return {
    rounds: session.rounds,
    questions: session.questions,
    session,
  }
}

// Placeholder for future remote API integration.
export async function getQuestionsFromApi(config) {
  return getQuestionsByConfig(config)
}
