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
import { useConversation } from '../../../features/conversation/hooks/useConversation.js'

export default function AISimulatedInterviewPage() {
  const navigate = useNavigate()
  const { user, resume } = useInterview()
  const { session, errors, actions } = useInterviewSession({ autoBootstrap: true })
  const [error, setError] = useState(null)

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

  if (errors?.length && !session) {
    return <ErrorState title="Conversation failed to load" message={errors[0]} onRetry={() => actions.bootstrap()} />
  }

  if (!session) {
    return <LoadingScreen title="Preparing conversational interview…" subtitle="Creating backend session." />
  }

  const speaking = conversation.lifecycle === 'ai_speaking'
  const thinking = conversation.lifecycle === 'ai_processing'
  const listening = conversation.lifecycle === 'listening'

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6 shadow-lg shadow-black/25">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200">
          <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-emerald-200">Live</span>
          <span>Conversational AI Interview</span>
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-slate-100">
          {session.company} — {session.role}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Voice-powered interview via ElevenLabs WebRTC. Reasoning and memory run on NexoPrep backend (Gemini).
        </p>
        {error ? <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        <div className="mt-3">
          <ConversationDiagnosticsBanner
            lastDisconnectReason={conversation.diagnostics?.lastDisconnectReason}
            lastReconnectTrigger={conversation.diagnostics?.lastReconnectTrigger}
            lastElevenLabsEvent={conversation.diagnostics?.lastElevenLabsEvent}
            agentDisconnectContext={conversation.diagnostics?.agentDisconnectContext}
          />
        </div>
        {conversation.connectionFailed ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Connection lost. Click Reconnect to continue the interview.
          </p>
        ) : conversation.isReconnecting ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Reconnecting to AI interviewer (attempt {conversation.reconnectAttempt}/{conversation.maxReconnectAttempts})…
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#111620] p-5 lg:col-span-1">
          <InterviewerAvatar speaking={speaking} thinking={thinking} />
          <Waveform active={speaking || listening} />
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
            onEnd={async () => {
              const backendSessionId = session.backendSessionId
              await conversation.end()
              actions.clear()
              navigate(backendSessionId ? `/report/${backendSessionId}` : '/dashboard')
            }}
            connectionFailed={conversation.connectionFailed}
            disabled={!conversation.ready && !conversation.connectionFailed}
          />
          <BehaviorCameraCard sessionId={session.backendSessionId} />
        </div>

        <div className="lg:col-span-2">
          <TranscriptPanel
            entries={conversation.entries}
            partialText={conversation.partialText}
            currentSpeaker={conversation.currentSpeaker}
          />
        </div>
      </section>
      <ConversationDebugPanel debug={conversation.debugInfo} />
      <InterviewOrchestratorDebugPanel sessionId={session.backendSessionId} />
    </div>
  )
}
