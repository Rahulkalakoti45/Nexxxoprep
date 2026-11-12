import { useState } from 'react'
import { cx } from '../../../components/ui/helpers.js'
import { Spinner } from '../../../components/ui/index.jsx'

function MicIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  )
}

/**
 * The call controls: a big mute button, end-interview with a confirm step (ending early still
 * produces a report, but it should never happen by accident), and Reconnect only when needed.
 */
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
  const [confirming, setConfirming] = useState(false)
  const [ending, setEnding] = useState(false)
  const showReconnect = connectionFailed || reconnecting

  const finish = async () => {
    setEnding(true)
    try {
      await onEnd()
    } finally {
      setEnding(false)
      setConfirming(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {confirming ? (
        <div role="alertdialog" aria-label="End interview" className="w-full max-w-sm animate-rise rounded-2xl border border-line-strong bg-raised p-4 text-center shadow-2xl">
          <p className="font-semibold text-ink">End the interview now?</p>
          <p className="mt-1 text-sm text-ink-muted">You&apos;ll get a report on everything you&apos;ve answered so far.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={ending} className="h-10 rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-white/[0.06]">
              Keep going
            </button>
            <button type="button" onClick={finish} disabled={ending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white hover:bg-rose-400">
              {ending ? (
                <>
                  <Spinner /> Writing report…
                </>
              ) : (
                'End & see report'
              )}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMuteToggle}
          disabled={disabled || connectionFailed}
          aria-pressed={muted}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          className={cx(
            'grid h-14 w-14 place-items-center rounded-full border transition disabled:opacity-40',
            muted ? 'border-amber-300/50 bg-amber-400/15 text-amber-200' : 'border-line-strong bg-white/[0.05] text-ink hover:bg-white/[0.1]',
          )}
        >
          <MicIcon off={muted} />
        </button>

        {showReconnect ? (
          <button
            type="button"
            onClick={onReconnect}
            disabled={reconnecting || connecting}
            className="inline-flex h-14 items-center gap-2 rounded-full bg-brand-500 px-6 font-semibold text-white shadow-glow transition hover:bg-brand-400 disabled:opacity-60"
          >
            {reconnecting || connecting ? <Spinner /> : null}
            {reconnecting ? 'Reconnecting…' : connecting ? 'Connecting…' : 'Reconnect'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={disabled || confirming}
          className="inline-flex h-14 items-center gap-2 rounded-full bg-rose-500/90 px-6 font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-[135deg]" fill="currentColor" aria-hidden="true">
            <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
          </svg>
          End interview
        </button>
      </div>

      {import.meta.env.DEV ? (
        <p className="font-mono text-[10px] text-ink-faint">
          {lifecycle} · {connectionStatus} · session {sessionActive ? 'on' : 'off'} · transport {transportReady ? 'ready' : '—'}
        </p>
      ) : null}
    </div>
  )
}
