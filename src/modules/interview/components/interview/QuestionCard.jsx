import { Badge } from '../../../../components/ui/index.jsx'
import { cx } from '../../../../components/ui/helpers.js'

/** The interviewer's current question, typed out, with its round and topic. */
export default function QuestionCard({ question, displayedText, thinking = false }) {
  if (!question) {
    return (
      <div className="rounded-2xl border border-line bg-inset p-5 text-sm text-ink-muted">
        Loading the next question…
      </div>
    )
  }

  const typing = displayedText && displayedText.length < question.question.length

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-gradient-to-br from-raised to-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span
          className={cx('h-9 w-9 shrink-0 rounded-full', thinking ? 'animate-pulse' : '')}
          style={{ background: 'radial-gradient(circle at 35% 30%, #efeaff 0%, #9d8cff 30%, #5640d6 75%)' }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Interviewer</p>
          <p className="text-xs text-ink-muted">{thinking ? 'Reading your answer…' : `${question.round} · ${question.domain}`}</p>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
          {question.isFollowUp ? <Badge tone="warn">Follow-up</Badge> : null}
          {question.difficulty ? <Badge>{question.difficulty}</Badge> : null}
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap font-display text-xl font-medium leading-snug text-ink sm:text-2xl" aria-live="polite">
        {displayedText || question.question}
        {typing ? <span className="ml-0.5 inline-block h-5 w-[3px] animate-pulse rounded-sm bg-brand-300 align-middle" aria-hidden="true" /> : null}
      </p>
    </div>
  )
}
