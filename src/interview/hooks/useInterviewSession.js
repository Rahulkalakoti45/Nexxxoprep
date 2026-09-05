import { useEffect, useMemo, useReducer } from 'react'
import { createInterviewSession } from '../engine/createInterviewSession.js'
import { evaluateInterviewAnswer } from '../engine/answerEvaluator.js'
import { generateFollowUp } from '../engine/followUpGenerator.js'
import { clearInterviewSession, loadInterviewSession, saveInterviewSession } from '../utils/interviewStorage.js'
import { getCurrentQuestion, getProgress, getRoundIndex } from '../utils/questionHelpers.js'

function safeSession(config) {
  return createInterviewSession(config || {})
}

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return safeSession(action.payload)
    case 'LOAD':
      return action.payload || safeSession(action.config)
    case 'SUBMIT': {
      const currentQuestion = getCurrentQuestion(state)
      if (!currentQuestion) return state
      const status = action.status || 'answered'
      const safeAnswer = typeof action.answer === 'string' ? action.answer.trim() : ''
      const feedback =
        status === 'skipped'
          ? { score: 0, confidenceScore: 0, clarityScore: 0, strengths: [], weaknesses: ['Skipped question.'], suggestions: ['Attempt all questions for better signal.'], meta: { wordCount: 0 } }
          : evaluateInterviewAnswer(safeAnswer, currentQuestion)
      const entry = { question: currentQuestion, answer: safeAnswer, status, feedback, answeredAt: new Date().toISOString() }
      const nextAnswers = [...state.answers, entry]
      const followUpCount = nextAnswers.filter((item) => item.question?.parentQuestionId === currentQuestion.id).length
      const followUp = generateFollowUp({ question: currentQuestion, feedback, followUpCount })
      const nextQuestions = [...state.questions]
      if (followUp && !currentQuestion.isFollowUp) {
        nextQuestions.splice(state.currentQuestionIndex + 1, 0, followUp)
      }
      const nextIndex = Math.min(state.currentQuestionIndex + 1, Math.max(0, nextQuestions.length - 1))
      const nextQuestion = nextQuestions[nextIndex]
      const complete = nextAnswers.length >= nextQuestions.length

      return {
        ...state,
        answers: nextAnswers,
        questions: nextQuestions,
        flattenedQuestions: nextQuestions,
        currentQuestionIndex: nextIndex,
        currentRoundIndex: getRoundIndex({ ...state, rounds: state.rounds }, nextQuestion),
        completedAt: complete ? new Date().toISOString() : null,
      }
    }
    default:
      return state
  }
}

export function useInterviewSession(config) {
  const [session, dispatch] = useReducer(reducer, null, () => loadInterviewSession() || safeSession(config))

  useEffect(() => {
    saveInterviewSession(session)
  }, [session])

  useEffect(() => {
    if (!config) return
    dispatch({ type: 'LOAD', payload: loadInterviewSession(), config })
  }, [config])

  const currentQuestion = useMemo(() => getCurrentQuestion(session), [session])
  const progress = useMemo(() => getProgress(session), [session])

  const submitAnswer = (answer, status = 'answered') => {
    const activeQuestion = getCurrentQuestion(session)
    if (!activeQuestion) return null
    const feedback =
      status === 'skipped'
        ? { score: 0, confidenceScore: 0, clarityScore: 0, strengths: [], weaknesses: ['Skipped question.'], suggestions: [], meta: { wordCount: 0 } }
        : evaluateInterviewAnswer(answer, activeQuestion)
    const previewEntry = { question: activeQuestion, answer: (answer || '').trim(), status, feedback }
    dispatch({ type: 'SUBMIT', answer, status })
    return previewEntry
  }

  const restart = () => {
    clearInterviewSession()
    dispatch({ type: 'RESET', payload: config })
  }

  return { session, currentQuestion, progress, submitAnswer, restart }
}
