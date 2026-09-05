import { useEffect, useMemo, useRef } from 'react'
import { useInterviewModule } from '../context/InterviewContext'

export function useInterviewSession({ autoBootstrap = false, config, resume = null } = {}) {
  const { session, status, errors, actions } = useInterviewModule()
  const bootstrapInFlight = useRef(false)
  // Set once this hook instance has ever seen a live session. Makes
  // auto-bootstrap strictly one-shot per mounted InterviewProvider
  // instance — see the note below for why `session` alone isn't enough.
  const hasBootstrappedRef = useRef(false)

  useEffect(() => {
    if (session) hasBootstrappedRef.current = true
  }, [session])

  useEffect(() => {
    if (!autoBootstrap || session) return
    // Without hasBootstrappedRef, ending an interview re-triggers this:
    // onEnd handlers call `actions.clear()` (dispatches RESET -> session
    // becomes null) immediately before `navigate()`. `actions.clear()`
    // sets session back to null in the same render pass in which
    // navigate() is swapping routes — until that swap fully unmounts
    // this component tree, `!autoBootstrap || session` is indistinguishable
    // from "this provider never bootstrapped a session yet", so this
    // effect fires actions.bootstrap() again, POSTs a new session, and
    // launches a second Behavior Engine for the interview that just
    // ended. Once hasBootstrappedRef is set, auto-bootstrap refuses to
    // fire again for the lifetime of this hook instance. Every route
    // (/interview, /setup) mounts its own fresh InterviewProvider, so a
    // real new session always gets a fresh ref = false naturally, and
    // manual retry via ErrorState's onRetry={() => actions.bootstrap()}
    // is a separate, explicit call path unaffected by this guard.
    if (hasBootstrappedRef.current) return
    // Guard against re-entrant bootstrap calls: `actions` is only stable
    // while its own dependencies (bootstrapConfig/resume/userId) are
    // stable, so if any of those change identity while a bootstrap is
    // still in flight, this effect re-runs before `session` is set —
    // and without this guard, each re-run fires another
    // POST /api/sessions (and, since Phase 3B, another Behavior Engine
    // process). `session` alone can't guard this because it only
    // updates after the async call resolves.
    if (bootstrapInFlight.current) return
    bootstrapInFlight.current = true
    Promise.resolve(actions.bootstrap(config, resume)).finally(() => {
      bootstrapInFlight.current = false
    })
  }, [actions, autoBootstrap, config, resume, session])

  useEffect(() => {
    if (session) actions.persist()
  }, [actions, session])

  const currentQuestion = useMemo(() => {
    if (!session?.questions?.length) return null
    return session.questions[session.currentQuestionIndex] || null
  }, [session])

  const currentRoundIndex = useMemo(() => {
    if (!session?.rounds?.length || !currentQuestion) return 0
    const id = currentQuestion.parentQuestionId || currentQuestion.id
    const idx = session.rounds.findIndex((r) => r.questionIds.includes(id))
    return idx === -1 ? 0 : idx
  }, [currentQuestion, session?.rounds])

  return { session, status, errors, actions, currentQuestion, currentRoundIndex }
}

