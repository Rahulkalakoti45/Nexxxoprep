import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../../../hooks/useInterview.js'
import { useInterviewSession } from '../hooks/useInterviewSession'
import LoadingScreen from '../components/shared/LoadingScreen'
import ErrorState from '../components/shared/ErrorState'
import InterviewerAvatar from '../../../features/conversation/components/InterviewerAvatar.jsx'
import Waveform from '../../../features/conversation/components/Waveform.jsx'
import TranscriptPanel from '../../../features/conversation/components/TranscriptPanel.jsx'
import ConversationControls from '../../../features/conversation/components/ConversationControls.jsx'
import ConversationDiagnosticsBanner from '../../../features/conversation/components/ConversationDiagnosticsBanner.jsx'
import ConversationDebugPanel from '../../../features/conversation/components/ConversationDebugPanel.jsx'
import InterviewOrchestratorDebugPanel from '../../../features/conversation/components/InterviewOrchestratorDebugPanel.jsx'
import BehaviorCameraCard from '../components/interview/BehaviorCameraCard.jsx'
import { finalizeBehavior } from '../../../features/behavior/useBehaviorAnalysis.js'
import { useConversation } from '../../../features/conversation/hooks/useConversation.js'
import { cx } from '../../../components/ui/helpers.js'

const TIPS = [
  'Think out loud. Interviewers score your reasoning, not just the answer.',
  'Use a real example from your projects whenever you can.',
  'Not sure? Say what you would try first. That still earns credit.',
]

/** mm:ss since the interview started, ticking once a second. */
function ElapsedClock({ since }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const start = Date.parse(since || '') || now
  const total = Math.max(0, Math.floor((now - start) / 1000))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return (
    <span className="font-mono tabular-nums" aria-label={`Elapsed ${m} minutes ${s} seconds`}>
      {m}:{s}
    </span>
  )
}

/** One visual state for the orb, derived from the conversation lifecycle. */
function avatarState(conversation) {
  if (conversation.connectionFailed) return 'failed'
  if (conversation.isReconnecting) return 'reconnecting'
  if (conversation.isConnecting || !conversation.ready) return 'connecting'
  if (conversation.lifecycle === 'ai_speaking') return 'speaking'
  if (conversation.lifecycle === 'ai_processing') return 'thinking'
  if (conversation.muted) return 'muted'
  return 'listening'
}

export default function AISimulatedInterviewPage() {
  const navigate = useNavigate()
  const { user, resume } = useInterview()
  const { session, errors, actions } = useInterviewSession({ autoBootstrap: true })
  const [error, setError] = useState(null)
  const [panel, setPanel] = useState('transcript')
  const [slowConnect, setSlowConnect] = useState(false)

  const conversation = useConversation({
    session,
    user,
    resume,
    onError: setError,
  })

  useEffect(() => {
    if (!session?.backendSessionId) return
    if (conversation.ready || conversation.isConnecting || conversation.isReconnecting) return
    if (conversation.connectionFailed) return
    void conversation.start()
  }, [
    session?.backendSessionId,
    conversation.ready,
    conversation.isConnecting,
    conversation.isReconnecting,
    conversation.connectionFailed,
    conversation.start,
  ])

  const state = session ? avatarState(conversation) : 'connecting'

  // If connecting drags on (server down, bad network), say so and offer a retry instead of
  // leaving the candidate staring at a spinner.
  useEffect(() => {
    if (state !== 'connecting') return undefined
    const timer = setTimeout(() => setSlowConnect(true), 15000)
    return () => clearTimeout(timer)
  }, [state])

  if (errors?.length && !session) {
    return <ErrorState title="We couldn’t start the interview" message={errors[0]} onRetry={() => actions.bootstrap()} />
  }

  if (!session) {
    return <LoadingScreen title="Setting up your interview…" subtitle="Reading your resume and planning the rounds." />
  }

  // Phones get a smaller orb so the call controls stay on screen.
  const compact = typeof window !== 'undefined' && window.innerWidth < 640
  const speaking = state === 'speaking'
  const listening = state === 'listening'

  // The interviewer's latest line, shown large like subtitles so the question is never lost.
  const interviewerLines = conversation.entries.filter((e) => e.speaker !== 'user' && e.speaker !== 'candidate')
  const liveInterviewerText = conversation.currentSpeaker === 'ai' && conversation.partialText ? conversation.partialText : null
  const caption = liveInterviewerText || interviewerLines[interviewerLines.length - 1]?.content || null
  const questionsSoFar = interviewerLines.filter((e) => e.content.includes('?')).length

  const endInterview = async () => {
    const backendSessionId = session.backendSessionId
    // Saves the on-device behavior summary while the conversation wraps up.
    // Never rejects and gives up after a few seconds, so it can't block the report.
    const savingBehavior = finalizeBehavior(backendSessionId)
    await conversation.end()
    await savingBehavior
    actions.clear()
    navigate(backendSessionId ? `/report/${backendSessionId}` : '/dashboard')
  }

  return (
    <div className="space-y-4">
      {/* Status strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
            </span>
            Live
          </span>
          <p className="truncate font-display text-lg font-semibold text-ink">
            {session.role} <span className="font-sans text-base font-normal text-ink-muted">at {session.company}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-muted">
          {questionsSoFar ? <span>{questionsSoFar} {questionsSoFar === 1 ? 'question' : 'questions'}</span> : null}
          <span className="rounded-lg border border-line bg-surface px-2.5 py-1 text-ink">
            <ElapsedClock since={session.startedAt} />
          </span>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {import.meta.env.DEV ? (
        <ConversationDiagnosticsBanner
          lastDisconnectReason={conversation.diagnostics?.lastDisconnectReason}
          lastReconnectTrigger={conversation.diagnostics?.lastReconnectTrigger}
          lastElevenLabsEvent={conversation.diagnostics?.lastElevenLabsEvent}
          agentDisconnectContext={conversation.diagnostics?.agentDisconnectContext}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Stage */}
        <section className="relative flex flex-col sm:min-h-[560px] overflow-hidden rounded-3xl border border-line-strong bg-gradient-to-b from-raised via-surface to-canvas shadow-card">
          <div
            className={cx(
              'pointer-events-none absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700',
              listening ? 'bg-emerald-400/10' : 'bg-brand-500/15',
            )}
            aria-hidden="true"
          />

          <div className="relative flex flex-1 flex-col items-center justify-center px-4 pt-4 sm:pt-6">
            <InterviewerAvatar state={state} size={compact ? 116 : 176} />
            <div className="mt-4">
              <Waveform active={speaking || listening} tone={listening ? 'listening' : 'brand'} />
            </div>
          </div>

          <div className="relative px-5 pb-4 sm:px-8">
            {slowConnect && state === 'connecting' ? (
              <div role="status" className="mx-auto mb-3 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-100">
                <span>This is taking longer than usual. Check your internet connection, then try again.</span>
                <button
                  type="button"
                  onClick={() => {
                    setSlowConnect(false)
                    if (session.backendSessionId) conversation.reconnect()
                    else actions.switchMode('ai_simulated')
                  }}
                  className="rounded-xl bg-amber-400/90 px-3.5 py-1.5 font-semibold text-canvas hover:bg-amber-300"
                >
                  Try again
                </button>
              </div>
            ) : null}
            {caption ? (
              <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-canvas/60 px-5 py-4 text-center backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">Interviewer</p>
                <p className="mt-1.5 text-lg leading-relaxed text-ink sm:text-xl">{caption}</p>
              </div>
            ) : (
              <ul className="mx-auto hidden max-w-2xl gap-2 sm:grid sm:grid-cols-3">
                {TIPS.map((tip) => (
                  <li key={tip} className="rounded-xl border border-line bg-canvas/50 px-3.5 py-3 text-xs leading-relaxed text-ink-muted">
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative border-t border-line bg-canvas/40 px-4 py-5 backdrop-blur">
            <ConversationControls
              lifecycle={conversation.lifecycle}
              connectionStatus={conversation.connectionStatus}
              muted={conversation.muted}
              onMuteToggle={conversation.toggleMute}
              onReconnect={conversation.reconnect}
              reconnecting={conversation.isReconnecting}
              connecting={conversation.isConnecting}
              sessionActive={conversation.sessionActive}
              transportReady={conversation.transportReady}
              onEnd={endInterview}
              connectionFailed={conversation.connectionFailed}
              disabled={!conversation.ready && !conversation.connectionFailed}
            />
          </div>
        </section>

        {/* Side panel: transcript or camera coaching */}
        <aside className="flex min-h-[420px] flex-col rounded-3xl border border-line bg-surface p-4 shadow-card lg:h-[calc(100vh-11rem)] lg:min-h-[560px]">
          <div className="flex rounded-xl border border-line bg-inset p-1 text-sm" role="tablist" aria-label="Side panel">
            {[
              ['transcript', 'Transcript'],
              ['camera', 'Camera coach'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={panel === id}
                onClick={() => setPanel(id)}
                className={cx('flex-1 rounded-lg px-3 py-1.5 font-medium transition', panel === id ? 'bg-white/[0.09] text-ink' : 'text-ink-muted hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Both stay mounted so switching tabs never stops the camera or loses scroll. */}
          <div className={cx('mt-3 min-h-0 flex-1', panel === 'transcript' ? 'flex flex-col' : 'hidden')}>
            <TranscriptPanel className="flex-1" entries={conversation.entries} partialText={conversation.partialText} currentSpeaker={conversation.currentSpeaker} />
          </div>
          <div className={cx('mt-3 min-h-0 flex-1 overflow-y-auto', panel === 'camera' ? 'block' : 'hidden')}>
            <p className="mb-3 text-xs text-ink-muted">Only you see this. Tips on posture and eye contact show up in your report.</p>
            <BehaviorCameraCard sessionId={session.backendSessionId} />
          </div>
        </aside>
      </div>

      <ConversationDebugPanel debug={conversation.debugInfo} />
      <InterviewOrchestratorDebugPanel sessionId={session.backendSessionId} />
    </div>
  )
}
