import { useEffect } from 'react'
import { useInterviewV2Context } from '../context/InterviewV2Context'
import { saveSession } from '../utils/storage'

export function useInterviewSession({ autoBootstrap = true } = {}) {
  const { state, currentQuestion, actions } = useInterviewV2Context()

  useEffect(() => {
    if (autoBootstrap && state.status === 'idle') {
      actions.bootstrapSession()
    }
  }, [actions, autoBootstrap, state.status])

  useEffect(() => {
    if (state.sessionId) {
      saveSession(state)
    }
  }, [state])

  return {
    state,
    currentQuestion,
    actions,
  }
}
