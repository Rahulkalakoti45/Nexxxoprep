import { useState } from 'react'
import { Badge, Card, CardHeader } from '../../components/ui/index.jsx'
import { cx } from '../../components/ui/helpers.js'
import { IconCheck, IconSparkle, IconTarget } from '../../components/ui/icons.jsx'

const VERDICT = {
  strong: { label: 'Strong', tone: 'good', bar: 'bg-emerald-400' },
  okay: { label: 'Okay', tone: 'warn', bar: 'bg-amber-400' },
  weak: { label: 'Needs work', tone: 'bad', bar: 'bg-rose-400' },
}

function formatClock(seconds) {
  if (seconds === null || seconds === undefined) return null
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

/** The answer with the quoted words highlighted, when they can be found as written. */
function AnswerText({ answer, quote }) {
  const at = quote ? answer.toLowerCase().indexOf(quote.toLowerCase()) : -1
  if (at === -1) return <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-ink-soft">{answer}</p>
  return (
    <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-ink-soft">
      {answer.slice(0, at)}
      <mark className="rounded bg-amber-300/20 px-0.5 text-amber-50 decoration-amber-300/60 underline-offset-4">{answer.slice(at, at + quote.length)}</mark>
      {answer.slice(at + quote.length)}
    </p>
  )
}

function ReviewCard({ review, index }) {
  const [showBetter, setShowBetter] = useState(review.verdict === 'weak')
  const verdict = review.verdict ? VERDICT[review.verdict] : null
  const clock = formatClock(review.askedAtSeconds)
  const quoteHighlighted = review.quote && review.answer.toLowerCase().includes(review.quote.toLowerCase())

  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-inset/60 p-4 pl-5 sm:p-5 sm:pl-6">
      {verdict ? <span className={cx('absolute inset-y-0 left-0 w-1', verdict.bar)} aria-hidden="true" /> : null}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-ink-faint">Q{index + 1}</span>
        {clock ? <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-ink-soft">{clock}</span> : null}
        {review.topic ? <span className="text-ink-muted">{review.topic}</span> : null}
        {verdict ? (
          <Badge tone={verdict.tone} className="ml-auto">
            {verdict.label}
          </Badge>
        ) : null}
      </div>

      <h4 className="mt-2.5 font-sans text-base font-semibold leading-snug text-ink">{review.question}</h4>

      <div className="mt-3 rounded-xl border border-line bg-surface p-3.5 text-[15px]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          You said · {review.wordCount} words{review.fillerCount ? ` · ${review.fillerCount} fillers` : ''}
        </p>
        <AnswerText answer={review.answer} quote={review.quote} />
        {review.quote && !quoteHighlighted ? (
          <blockquote className="mt-2 border-l-2 border-amber-300/50 pl-3 text-amber-100">“{review.quote}”</blockquote>
        ) : null}
      </div>

      {review.whatWorked || review.whatWasMissing ? (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {review.whatWorked ? (
            <div className="flex gap-2.5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">What worked</p>
                <p className="mt-1 text-ink-soft">{review.whatWorked}</p>
              </div>
            </div>
          ) : null}
          {review.whatWasMissing ? (
            <div className="flex gap-2.5 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] p-3.5">
              <IconTarget className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300/90">What was missing</p>
                <p className="mt-1 text-ink-soft">{review.whatWasMissing}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {review.betterAnswer ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowBetter((open) => !open)}
            aria-expanded={showBetter}
            className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-brand-300 transition hover:text-brand-200"
          >
            <IconSparkle className="h-4 w-4" />
            {showBetter ? 'Hide stronger answer' : 'Show a stronger answer'}
          </button>
          {showBetter ? (
            <div className="mt-2 animate-rise rounded-xl border border-brand-400/25 bg-brand-500/[0.08] p-4 text-[15px]">
              <p className="whitespace-pre-wrap leading-relaxed text-ink">{review.betterAnswer}</p>
              <p className="mt-3 text-xs text-ink-muted">Built from your own answer and resume. Say it in your own words; don&apos;t memorise it.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

/** Every answered question with what was said, when, and how to answer it better. */
export default function AnswerReviewSection({ reviews }) {
  const [filter, setFilter] = useState('all')
  if (!reviews?.length) return null

  const hasCoaching = reviews.some((r) => r.verdict)
  const needsWork = reviews.filter((r) => r.verdict === 'weak' || r.verdict === 'okay')
  const counts = { strong: 0, okay: 0, weak: 0 }
  for (const r of reviews) if (r.verdict) counts[r.verdict] += 1
  const shown = filter === 'needs_work' ? needsWork : reviews

  return (
    <Card>
      <CardHeader
        title="Answer-by-answer review"
        subtitle={
          hasCoaching
            ? 'Every comment points at words you actually said. Highlighted text is what the feedback is about.'
            : 'Your questions and answers from this interview. Detailed coaching wasn’t generated for this one.'
        }
        action={
          hasCoaching && needsWork.length ? (
            <div className="flex rounded-xl border border-line bg-inset p-1 text-sm" role="group" aria-label="Filter answers">
              {[
                ['all', `All ${reviews.length}`],
                ['needs_work', `To improve ${needsWork.length}`],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                  className={cx(
                    'rounded-lg px-3 py-1.5 font-medium transition',
                    filter === value ? 'bg-white/[0.09] text-ink' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null
        }
      />

      {hasCoaching ? (
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/[0.05]" aria-label={`${counts.strong} strong, ${counts.okay} okay, ${counts.weak} need work`}>
          {['strong', 'okay', 'weak'].map((key) =>
            counts[key] ? <span key={key} className={VERDICT[key].bar} style={{ width: `${(counts[key] / reviews.length) * 100}%` }} /> : null,
          )}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {shown.map((review) => (
          <ReviewCard key={review.sequence} review={review} index={reviews.indexOf(review)} />
        ))}
      </div>
    </Card>
  )
}
