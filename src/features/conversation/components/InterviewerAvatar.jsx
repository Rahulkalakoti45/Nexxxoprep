import { cx } from '../../../components/ui/helpers.js'

const STATE_COPY = {
  connecting: { title: 'Connecting', hint: 'Getting your interviewer ready…' },
  speaking: { title: 'Interviewer is speaking', hint: 'Listen to the full question before you answer.' },
  thinking: { title: 'Thinking', hint: 'Considering your answer…' },
  listening: { title: 'Your turn', hint: 'Speak naturally. Pausing to think is fine.' },
  muted: { title: 'You’re muted', hint: 'Unmute when you’re ready to answer.' },
  reconnecting: { title: 'Reconnecting', hint: 'Hang on, your interview is saved.' },
  failed: { title: 'Connection lost', hint: 'Tap Reconnect to pick up where you left off.' },
  idle: { title: 'Ready', hint: 'Your interviewer will start in a moment.' },
}

/**
 * The interviewer as a living orb. Each phase looks different so the candidate always knows
 * whose turn it is without reading anything: halos when it speaks, an orbiting dot while it
 * thinks, a calm breathing glow when it is listening.
 */
export default function InterviewerAvatar({ state = 'idle', size = 176 }) {
  const copy = STATE_COPY[state] || STATE_COPY.idle
  const speaking = state === 'speaking'
  const thinking = state === 'thinking'
  const listening = state === 'listening'
  const busy = state === 'connecting' || state === 'reconnecting'
  const failed = state === 'failed'

  return (
    <div className="flex flex-col items-center text-center" aria-live="polite">
      <div className="relative grid place-items-center" style={{ width: size * 1.6, height: size * 1.6 }}>
        {speaking
          ? [0, 0.7, 1.4].map((delay) => (
              <span
                key={delay}
                className="absolute rounded-full border-2 border-brand-300/50 animate-halo"
                style={{ width: size, height: size, animationDelay: `${delay}s` }}
                aria-hidden="true"
              />
            ))
          : null}

        {listening ? (
          <span className="absolute rounded-full bg-emerald-400/10 blur-2xl animate-breathe" style={{ width: size * 1.3, height: size * 1.3 }} aria-hidden="true" />
        ) : null}

        {thinking || busy ? (
          <span className="absolute animate-orbit" style={{ width: size + 28, height: size + 28 }} aria-hidden="true">
            <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-brand-200 shadow-[0_0_14px_4px_rgba(189,178,255,0.6)]" />
          </span>
        ) : null}

        <div
          className={cx(
            'relative rounded-full transition-all duration-500',
            speaking || thinking ? 'scale-100' : 'animate-breathe',
            failed ? 'grayscale' : '',
          )}
          style={{
            width: size,
            height: size,
            background: failed
              ? 'radial-gradient(circle at 35% 30%, #3b3f4c, #15171e 70%)'
              : listening
                ? 'radial-gradient(circle at 35% 30%, #c8f7e2 0%, #34d399 28%, #5640d6 75%, #1f1750 100%)'
                : 'radial-gradient(circle at 35% 30%, #efeaff 0%, #9d8cff 30%, #5640d6 70%, #1f1750 100%)',
            boxShadow: failed
              ? 'none'
              : speaking
                ? '0 0 80px 10px rgba(126,105,255,0.55), inset 0 -18px 40px rgba(0,0,0,0.35)'
                : '0 0 50px 0 rgba(126,105,255,0.35), inset 0 -18px 40px rgba(0,0,0,0.35)',
          }}
        >
          <span className="absolute inset-[14%] rounded-full bg-white/10 blur-md" aria-hidden="true" />
        </div>
      </div>

      <p className="-mt-2 font-display text-xl font-semibold text-ink">{copy.title}</p>
      <p className="mt-1 max-w-xs text-sm text-ink-muted">{copy.hint}</p>
    </div>
  )
}
