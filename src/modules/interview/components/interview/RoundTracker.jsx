import { cx } from '../../../../components/ui/helpers.js'

/** The interview's rounds as a vertical stepper: done, current, and still to come. */
export default function RoundTracker({ rounds = [], currentRoundIndex = 0, answers = {} }) {
  return (
    <ol className="space-y-1">
      {rounds.map((round, idx) => {
        const total = round.questionIds?.length || 0
        const answered = (round.questionIds || []).filter((id) => Boolean(answers[id])).length
        const isActive = idx === currentRoundIndex
        const isDone = idx < currentRoundIndex || (total > 0 && answered >= total)
        return (
          <li key={round.id} className="relative flex gap-3 pb-3 last:pb-0">
            {idx < rounds.length - 1 ? (
              <span className={cx('absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-px', isDone ? 'bg-brand-400/50' : 'bg-line-strong')} aria-hidden="true" />
            ) : null}
            <span
              className={cx(
                'relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                isDone ? 'border-brand-400 bg-brand-500 text-white' : isActive ? 'border-brand-400 bg-brand-500/15 text-brand-200 shadow-glow' : 'border-line-strong text-ink-faint',
              )}
            >
              {isDone ? '✓' : idx + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cx('text-sm font-medium', isActive ? 'text-ink' : isDone ? 'text-ink-soft' : 'text-ink-muted')}>{round.label}</p>
              <p className="text-xs text-ink-faint">
                {answered}/{total} answered
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
