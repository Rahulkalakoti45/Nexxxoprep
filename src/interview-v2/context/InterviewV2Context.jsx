import { createContext, useContext, useMemo, useReducer } from 'react'
import { evaluateAnswer } from '../engine/answerEvaluator'
import { createSession } from '../engine/createSession'
import { createFollowUpQuestion, shouldTriggerFollowUp } from '../engine/followUpEngine'
import { clearSession, loadSession, saveSession } from '../utils/storage'
import { validateSessionShape } from '../utils/validators'

const InterviewV2Context = createContext(null)

function deriveProgress(answers, total) {
  const answered = Object.keys(answers).length
  return {
    answered,
    total,
    percent: total ? Math.round((answered / total) * 100) : 0,
  }
}

const initialState = {
  sessionId: null,
  company: '',
  role: '',
  currentRoundIndex: 0,
  currentQuestionIndex: 0,
  rounds: [],
  questions: [],
  answers: {},
  progress: { answered: 0, total: 0, percent: 0 },
  startedAt: null,
  completedAt: null,
  status: 'idle',
  errors: [],
  followUpAskedFor: {},
}

function interviewReducer(state, action) {
  switch (action.type) {
    case 'INIT_SESSION':
      return { ...action.payload }
    case 'SET_ANSWER': {
      const answers = {
        ...state.answers,
        [action.payload.questionId]: {
          answer: action.payload.answer,
          evaluation: action.payload.evaluation,
          updatedAt: new Date().toISOString(),
        },
      }
      return {
        ...state,
        answers,
        progress: deriveProgress(answers, state.questions.length),
      }
    }
    case 'INJECT_FOLLOWUP': {
      const questions = [...state.questions]
      const insertAt = state.currentQuestionIndex + 1
      questions.splice(insertAt, 0, action.payload.followUp)
      return {
        ...state,
        questions,
        followUpAskedFor: {
          ...state.followUpAskedFor,
          [action.payload.parentQuestionId]: true,
        },
        progress: deriveProgress(state.answers, questions.length),
      }
    }
    case 'NEXT_QUESTION': {
      const nextIndex = Math.min(state.currentQuestionIndex + 1, state.questions.length)
      const status = nextIndex >= state.questions.length ? 'completed' : state.status
      return {
        ...state,
        currentQuestionIndex: nextIndex,
        completedAt: status === 'completed' ? new Date().toISOString() : state.completedAt,
        status,
      }
    }
    case 'SKIP_QUESTION':
      return {
        ...state,
        currentQuestionIndex: Math.min(state.currentQuestionIndex + 1, state.questions.length),
      }
    case 'SET_ROUND_INDEX':
      return { ...state, currentRoundIndex: action.payload }
    case 'FINISH':
      return { ...state, status: 'completed', completedAt: new Date().toISOString() }
    case 'SET_ERROR':
      return { ...state, errors: [...state.errors, action.payload] }
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}

export function InterviewV2Provider({ children, initialConfig }) {
  const [state, dispatch] = useReducer(interviewReducer, initialState)

  const actions = useMemo(
    () => ({
      bootstrapSession(config = initialConfig) {
        try {
          const stored = loadSession()
          if (stored && validateSessionShape(stored)) {
            dispatch({ type: 'INIT_SESSION', payload: stored })
            return
          }
          const session = createSession(config)
          dispatch({ type: 'INIT_SESSION', payload: session })
          saveSession(session)
        } catch (_error) {
          const fallbackSession = createSession({ company: 'amazon', role: 'SDE' })
          dispatch({ type: 'INIT_SESSION', payload: fallbackSession })
        }
      },
      submitAnswer(answer) {
        const question = state.questions[state.currentQuestionIndex]
        if (!question) return
        const evaluation = evaluateAnswer(answer, question)

        dispatch({
          type: 'SET_ANSWER',
          payload: { questionId: question.id, answer, evaluation },
        })

        const followUpAlreadyAsked = state.followUpAskedFor[question.id]
        if (!question.isFollowUp && !followUpAlreadyAsked && shouldTriggerFollowUp({ answer, evaluation })) {
          const followUp = createFollowUpQuestion(question, answer, evaluation)
          if (followUp) {
            dispatch({
              type: 'INJECT_FOLLOWUP',
              payload: { followUp, parentQuestionId: question.id },
            })
          }
        }
      },
      nextQuestion() {
        dispatch({ type: 'NEXT_QUESTION' })
      },
      skipQuestion() {
        dispatch({ type: 'SKIP_QUESTION' })
      },
      finishInterview() {
        dispatch({ type: 'FINISH' })
      },
      resetInterview() {
        clearSession()
        dispatch({ type: 'RESET' })
      },
    }),
    [initialConfig, state.currentQuestionIndex, state.followUpAskedFor, state.questions],
  )

  const currentQuestion = state.questions[state.currentQuestionIndex] || null

  const currentRoundIndex = state.rounds.findIndex((round) =>
    round.questionIds.includes(currentQuestion?.parentQuestionId || currentQuestion?.id),
  )

  const value = useMemo(
    () => ({
      state: {
        ...state,
        currentRoundIndex: currentRoundIndex === -1 ? state.currentRoundIndex : currentRoundIndex,
      },
      currentQuestion,
      actions,
    }),
    [actions, currentQuestion, currentRoundIndex, state],
  )

  return <InterviewV2Context.Provider value={value}>{children}</InterviewV2Context.Provider>
}

export function useInterviewV2Context() {
  const context = useContext(InterviewV2Context)
  if (!context) {
    throw new Error('useInterviewV2Context must be used within InterviewV2Provider')
  }
  return context
}
