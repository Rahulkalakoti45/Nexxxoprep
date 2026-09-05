export default function ConversationDiagnosticsBanner({
  lastDisconnectReason,
  lastReconnectTrigger,
  lastElevenLabsEvent,
  agentDisconnectContext,
}) {
  return (
    <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/40 p-4 font-mono text-xs text-cyan-100">
      <p className="mb-2 font-semibold text-cyan-300">Disconnect Diagnostics (temporary)</p>
      <p>
        <span className="text-cyan-400">Last Disconnect Reason:</span>{' '}
        {lastDisconnectReason || '—'}
      </p>
      <p className="mt-1">
        <span className="text-cyan-400">Last Reconnect Trigger:</span>{' '}
        {lastReconnectTrigger || '—'}
      </p>
      <p className="mt-1 break-all">
        <span className="text-cyan-400">Last ElevenLabs Event:</span>{' '}
        {lastElevenLabsEvent || '—'}
      </p>
      {agentDisconnectContext ? (
        <p className="mt-1 break-all text-amber-200">
          <span className="text-amber-400">Agent context:</span> {agentDisconnectContext}
        </p>
      ) : null}
    </div>
  )
}
