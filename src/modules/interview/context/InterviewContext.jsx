import { createContext, useContext, useMemo, useReducer, useRef } from 'react'
import { createInterviewSession } from '../engine/createInterviewSession'
import { evaluateAnswer } from '../engine/answerEvaluator'
import { buildFollowUp, shouldFollowUp } from '../engine/followUpEngine'
import { clearInterviewSessionV2, loadInterviewSessionV2, saveInterviewSessionV2 } from '../utils/storage'
import { validateSessionShape } from '../utils/validators'
import {
  attachBackendToLocalSession,
  hydrateSessionFromBackend,
  syncTranscriptAnswer,
} from '../../../services/backendSessionSync.js'
import { resetSyncQueue } from '../../../lib/syncQueue.js'

const InterviewModuleContext = createContext(null)

const initialState = {
  session: null,
  status: 'idle',
  errors: [],
  syncing: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'BOOTSTRAP':
      return { ...state, session: action.payload, status: 'in_progress', errors: [] }
    case 'SET_SYNCING':
      return { ...state, syncing: action.payload }
    case 'SET_ERROR':
      return { ...state, errors: [...state.errors, action.payload] }
    case 'RESET':
      return { ...initialState }
    case 'SUBMIT_ANSWER': {
      const { questionId, answer, evaluation, status, timeTakenSeconds } = action.payload
      const nextSession = {
        ...state.session,
        answers: {
          ...state.session.answers,
          [questionId]: {
            questionId,
            answer,
            answeredAt: new Date().toISOString(),
            status: status || (answer && String(answer).trim() ? 'answered' : 'pending'),
            timeTakenSeconds: Number.isFinite(timeTakenSeconds) ? Math.max(0, Math.round(timeTakenSeconds)) : 0,
            score: evaluation?.score ?? 0,
            confidence: evaluation?.confidence ?? 'low',
            clarity: evaluation?.clarity ?? 'unclear',
            evaluation,
            updatedAt: new Date().toISOString(),
          },
        },
      }
      nextSession.progress = {
        answered: Object.keys(nextSession.answers).length,
        total: nextSession.questions.length,
        percent: nextSession.questions.length
          ? Math.round((Object.keys(nextSession.answers).length / nextSession.questions.length) * 100)
          : 0,
      }
      return { ...state, session: nextSession }
    }
    case 'INJECT_FOLLOWUP': {
      const { followUp, parentQuestionId } = action.payload
      const questions = [...state.session.questions]
      questions.splice(state.session.currentQuestionIndex + 1, 0, followUp)
      const nextSession = {
        ...state.session,
        questions,
        followUpAskedFor: { ...(state.session.followUpAskedFor || {}), [parentQuestionId]: true },
      }
      nextSession.progress = {
        ...state.session.progress,
        total: questions.length,
        percent: questions.length ? Math.round((nextSession.progress.answered / questions.length) * 100) : 0,
      }
      return { ...state, session: nextSession }
    }
    case 'NEXT': {
      const idx = Math.min(state.session.currentQuestionIndex + 1, state.session.questions.length)
      const isComplete = idx >= state.session.questions.length
      return {
        ...state,
        session: {
          ...state.session,
          currentQuestionIndex: idx,
          completedAt: isComplete ? new Date().toISOString() : state.session.completedAt,
        },
        status: isComplete ? 'completed' : state.status,
      }
    }
    case 'SKIP': {
      const idx = Math.min(state.session.currentQuestionIndex + 1, state.session.questions.length)
      return { ...state, session: { ...state.session, currentQuestionIndex: idx } }
    }
    case 'SET_MODE': {
      return { ...state, session: { ...state.session, interviewMode: action.payload } }
    }
    case 'PATCH_SESSION': {
      return { ...state, session: { ...state.session, ...action.payload } }
    }
    default:
      return state
  }
}

export function InterviewProvider({ children, bootstrapConfig, resume, userId }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const sessionRef = useRef(null)
  sessionRef.current = state.session

  const effectiveUserId = userId || 'demo-candidate-user'

  const queueTranscript = (question, answerText, status, timeTakenSeconds) => {
    const session = sessionRef.current
    if (!session?.backendSessionId) return

    const sequence = session.transcriptSequence ?? 0
    const startedAt = new Date(Date.now() - (timeTakenSeconds || 0) * 1000).toISOString()
    const endedAt = new Date().toISOString()

    syncTranscriptAnswer(session.backendSessionId, {
      sequence,
      question,
      answer: answerText,
      status,
      startedAt,
      endedAt,
      session,
    })
      .then(() => {
        const latest = sessionRef.current
        if (!latest) return
        const next = { ...latest, transcriptSequence: sequence + 1 }
        sessionRef.current = next
        dispatch({ type: 'PATCH_SESSION', payload: { transcriptSequence: sequence + 1 } })
        saveInterviewSessionV2(next)
      })
      .catch((error) => {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Transcript sync failed' })
      })
  }

  const actions = useMemo(
    () => ({
      async bootstrap(config) {
        try {
          const stored = loadInterviewSessionV2()
          const cfg = config || bootstrapConfig
          const requested = cfg
            ? {
                company: cfg.company,
                role: cfg.role,
                difficulty: cfg.difficulty,
                interviewMode: cfg.interviewMode,
              }
            : null

          const storedMatches =
            stored &&
            validateSessionShape(stored) &&
            (!requested ||
              (stored.company === requested.company &&
                stored.role === requested.role &&
                stored.difficulty === requested.difficulty &&
                stored.interviewMode === requested.interviewMode))

          if (storedMatches) {
            let restored = stored
            if (stored.backendSessionId) {
              restored = await hydrateSessionFromBackend(stored, stored.backendSessionId)
            } else {
              try {
                restored = await attachBackendToLocalSession(stored, effectiveUserId)
              } catch {
                // Backend unavailable — continue with local session
              }
            }
            dispatch({ type: 'BOOTSTRAP', payload: restored })
            saveInterviewSessionV2(restored)
            return restored
          }

          dispatch({ type: 'SET_SYNCING', payload: true })
          resetSyncQueue()
          let session = createInterviewSession({ ...(cfg || {}), resume })
          try {
            session = await attachBackendToLocalSession(session, effectiveUserId)
          } catch {
            // Backend unavailable — continue with local session
          }
          dispatch({ type: 'BOOTSTRAP', payload: session })
          saveInterviewSessionV2(session)
          dispatch({ type: 'SET_SYNCING', payload: false })
          return session
        } catch (error) {
          dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to start interview' })
          let session = createInterviewSession({
            company: 'Amazon',
            role: 'SDE',
            difficulty: 'Medium',
            interviewMode: 'standard',
            resume: null,
          })
          try {
            session = await attachBackendToLocalSession(session, effectiveUserId)
          } catch {
            // ignore
          }
          dispatch({ type: 'BOOTSTRAP', payload: session })
          dispatch({ type: 'SET_SYNCING', payload: false })
          return session
        }
      },
      persist() {
        try {
          if (state.session) saveInterviewSessionV2(state.session)
        } catch {
          // ignore
        }
      },
      clear() {
        resetSyncQueue()
        clearInterviewSessionV2()
        dispatch({ type: 'RESET' })
      },
      submitAnswer(answerText) {
        const session = sessionRef.current
        const question = session?.questions?.[session.currentQuestionIndex]
        if (!session || !question) return null

        const evaluation = evaluateAnswer(answerText, question)
        dispatch({ type: 'SUBMIT_ANSWER', payload: { questionId: question.id, answer: answerText, evaluation } })
        queueTranscript(question, answerText, 'answered', 0)

        const followUpAsked = session.followUpAskedFor?.[question.id]
        if (!question.isFollowUp && !followUpAsked && shouldFollowUp({ answer: answerText, evaluation })) {
          const followUp = buildFollowUp(question, evaluation)
          dispatch({ type: 'INJECT_FOLLOWUP', payload: { followUp, parentQuestionId: question.id } })
        }
        return evaluation
      },
      submitWithStatus({ answerText, status, timeTakenSeconds }) {
        const session = sessionRef.current
        const question = session?.questions?.[session.currentQuestionIndex]
        if (!session || !question) return null

        const evaluation = status === 'skipped' ? evaluateAnswer('', question) : evaluateAnswer(answerText, question)
        dispatch({
          type: 'SUBMIT_ANSWER',
          payload: {
            questionId: question.id,
            answer: status === 'skipped' ? '' : answerText,
            evaluation,
            status,
            timeTakenSeconds,
          },
        })

        const text = status === 'skipped' ? '' : answerText
        queueTranscript(question, text, status, timeTakenSeconds)

        const followUpAsked = session.followUpAskedFor?.[question.id]
        if (
          status !== 'skipped' &&
          !question.isFollowUp &&
          !followUpAsked &&
          shouldFollowUp({ answer: answerText, evaluation })
        ) {
          const followUp = buildFollowUp(question, evaluation)
          dispatch({ type: 'INJECT_FOLLOWUP', payload: { followUp, parentQuestionId: question.id } })
        }

        return evaluation
      },
      next() {
        dispatch({ type: 'NEXT' })
      },
      skip() {
        dispatch({ type: 'SKIP' })
      },
      async switchMode(mode) {
        const current = sessionRef.current
        if (current) {
          let updated = { ...current, interviewMode: mode }
          if (!updated.backendSessionId) {
            try {
              updated = await attachBackendToLocalSession(updated, effectiveUserId)
            } catch {
              // ignore
            }
          }
          sessionRef.current = updated
          dispatch({ type: 'BOOTSTRAP', payload: updated })
          saveInterviewSessionV2(updated)
        }
      },
    }),
    [bootstrapConfig, resume, state.session, userId],
  )

  const value = useMemo(() => ({ ...state, actions }), [actions, state])

  return <InterviewModuleContext.Provider value={value}>{children}</InterviewModuleContext.Provider>
}

export function useInterviewModule() {
  const ctx = useContext(InterviewModuleContext)
  if (!ctx) throw new Error('useInterviewModule must be used inside InterviewProvider')
  return ctx
}
