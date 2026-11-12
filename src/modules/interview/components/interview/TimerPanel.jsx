import { useEffect, useState } from 'react'
import { cx } from '../../../../components/ui/helpers.js'

function format(sec) {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Time on this question against the suggested time, plus total interview time. Going over is
 * shown gently in amber; it is a guide, not a cut-off.
 */
export default function TimerPanel({ interviewStartedAt, questionStartedAt, suggestedSeconds = 0 }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const interviewSec = interviewStartedAt ? (now - interviewStartedAt) / 1000 : 0
  const questionSec = questionStartedAt ? (now - questionStartedAt) / 1000 : 0
  const pct = suggestedSeconds ? Math.min(100, (questionSec / suggestedSeconds) * 100) : 0
  const over = suggestedSeconds && questionSec > suggestedSeconds

  return (
    <div className="flex items-center gap-4 text-xs text-ink-muted">
      {suggestedSeconds ? (
        <div className="flex items-center gap-2" title="Time on this question / suggested">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.07]">
            <div className={cx('h-full rounded-full transition-[width] duration-1000', over ? 'bg-amber-400' : 'bg-brand-400')} style={{ width: `${pct}%` }} />
          </div>
          <span className={cx('font-mono tabular-nums', over ? 'text-amber-200' : 'text-ink-soft')}>
            {format(questionSec)} / {format(suggestedSeconds)}
          </span>
        </div>
      ) : null}
      <span className="font-mono tabular-nums">Total {format(interviewSec)}</span>
    </div>
  )
}
