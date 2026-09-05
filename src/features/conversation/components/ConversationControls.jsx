export default function ConversationControls({
  lifecycle,
  connectionStatus,
  muted,
  onMuteToggle,
  onEnd,
  onReconnect,
  reconnecting = false,
  connecting = false,
  sessionActive = false,
  transportReady = false,
  connectionFailed = false,
  disabled = false,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs text-slate-400">
        <p>Lifecycle: <span className="text-slate-200">{lifecycle}</span></p>
        <p className="mt-1">Connection: <span className="text-slate-200">{connectionStatus}</span></p>
        <p className="mt-1">Session active: <span className="text-slate-200">{sessionActive ? 'yes' : 'no'}</span></p>
        <p className="mt-1">Transport ready: <span className="text-slate-200">{transportReady ? 'yes' : 'no'}</span></p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onMuteToggle}
          disabled={disabled || connectionFailed}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-100 hover:bg-white/5 disabled:opacity-50"
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button
          type="button"
          onClick={onReconnect}
          disabled={reconnecting || connecting || (disabled && !connectionFailed)}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-100 hover:bg-white/5 disabled:opacity-50"
        >
          {reconnecting ? 'Reconnecting…' : connecting ? 'Connecting…' : connectionFailed ? 'Reconnect' : 'Reconnect'}
        </button>
        <button
          type="button"
          onClick={onEnd}
          disabled={disabled}
          className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100 hover:bg-red-500/30 disabled:opacity-50"
        >
          End Interview
        </button>
      </div>
    </div>
  )
}
