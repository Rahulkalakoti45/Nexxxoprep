import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCodingAttempt } from '../features/coding/interviewer.js'
import { loadAttempt } from '../features/coding/attemptSync.js'
import useInterview from '../hooks/useInterview.js'
import { PROBLEMS } from '../features/coding/problems.js'
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ScoreBar, ScoreRing, Skeleton } from '../components/ui/index.jsx'
import { cx } from '../components/ui/helpers.js'
import { IconArrowRight, IconCheck, IconClock, IconSparkle, IconTarget } from '../components/ui/icons.jsx'

const VERDICT = {
  strong: { label: 'Strong', tone: 'good', headline: 'Interview-ready on this one.' },
  okay: { label: 'Okay', tone: 'warn', headline: 'Close. A few things to tighten.' },
  weak: { label: 'Needs work', tone: 'bad', headline: 'Good practice. Here’s what to fix first.' },
}

/** The final code with the reviewer's comments pinned under the lines they refer to. */
function AnnotatedCode({ code, comments }) {
  const lines = code.replace(/\s+$/, '').split('\n')
  const notesByLine = new Map()
  for (const c of comments) {
    const first = c.snippet.split('\n')[0].trim()
    const at = lines.findIndex((line) => line.includes(first))
    if (at === -1) continue
    notesByLine.set(at, [...(notesByLine.get(at) || []), c.comment])
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-inset font-mono text-[13px]">
      {lines.map((line, i) => (
        <div key={i}>
          <div className={cx('flex', notesByLine.has(i) ? 'bg-amber-300/[0.08]' : '')}>
            <span className="w-10 shrink-0 select-none pr-3 text-right text-ink-faint">{i + 1}</span>
            <span className="whitespace-pre text-ink-soft">{line || ' '}</span>
          </div>
          {(notesByLine.get(i) || []).map((note) => (
            <div key={note} className="ml-10 mr-3 my-1.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 font-sans text-sm text-amber-50">
              {note}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function CodingResultPage() {
  const { attemptId } = useParams()
  const { user } = useInterview()
  // From this device when it's here; otherwise fetched from the account (e.g. another device).
  const [attempt, setAttempt] = useState(() => getCodingAttempt(attemptId))
  const [loading, setLoading] = useState(() => !getCodingAttempt(attemptId))

  useEffect(() => {
    if (attempt) return undefined
    let cancelled = false
    loadAttempt(user?.id, attemptId).then((found) => {
      if (cancelled) return
      setAttempt(found)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [attempt, attemptId, user?.id])
  const [showOptimal, setShowOptimal] = useState(false)
  const [showChat, setShowChat] = useState(false)

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading attempt">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!attempt) {
    return (
      <EmptyState
        title="We couldn’t find that attempt"
        body="It isn’t on this device, and we couldn’t load it from your account. Check your connection and try again."
        action={
          <ButtonLink to="/coding" variant="secondary">
            Back to coding
          </ButtonLink>
        }
      />
    )
  }

  const ev = attempt.evaluation
  const verdict = VERDICT[ev.verdict] || VERDICT.weak
  const run = attempt.finalRun
  // A tests-only score can say whether the code works, not whether the interview went well.
  const headline =
    ev.generatedBy === 'local'
      ? ev.scores.correctness === 100
        ? 'Every test passed.'
        : `${run.passed} of ${run.total} tests passed.`
      : verdict.headline
  const nextProblem = PROBLEMS[(PROBLEMS.findIndex((p) => p.id === attempt.problemId) + 1) % PROBLEMS.length]
  const scoreRows = [
    ['Correctness', ev.scores.correctness, 'From the tests, including hidden ones'],
    ['Efficiency', ev.scores.efficiency, 'Time and space vs. the optimal solution'],
    ['Code quality', ev.scores.codeQuality, 'Readability, naming, edge cases'],
    ['Communication', ev.scores.communication, 'How clearly you explained your thinking'],
  ]

  return (
    <div className="space-y-6">
      <Link to="/coding" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <IconArrowRight className="h-4 w-4 rotate-180" /> Coding
      </Link>

      <section className="relative overflow-hidden rounded-3xl border border-line-strong bg-gradient-to-br from-raised via-surface to-surface p-6 shadow-card sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center">
          <div className="flex justify-center md:block">
            <ScoreRing score={ev.overall} size={168} stroke={12} label="overall" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={verdict.tone}>{verdict.label}</Badge>
              <span className="text-xs text-ink-muted">{new Date(attempt.finishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">{headline}</h1>
            <p className="mt-2 text-ink-muted">
              {attempt.problemTitle} · {attempt.difficulty} · {attempt.languageLabel}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-inset px-3 py-1.5 text-ink-soft">
                <IconCheck className="h-4 w-4 text-ink-faint" /> {run.passed}/{run.total} tests
                {run.hiddenTotal ? ` (hidden ${run.hiddenPassed}/${run.hiddenTotal})` : ''}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-inset px-3 py-1.5 text-ink-soft">
                <IconClock className="h-4 w-4 text-ink-faint" /> {Math.max(1, Math.round(attempt.durationSeconds / 60))} min
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-inset px-3 py-1.5 text-ink-soft">
                <IconSparkle className="h-4 w-4 text-ink-faint" /> {attempt.hintsUsed} {attempt.hintsUsed === 1 ? 'hint' : 'hints'}
                {ev.hintPenalty ? ` (−${ev.hintPenalty})` : ''}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="How you scored" />
          <div className="mt-5 space-y-4">
            {scoreRows.map(([label, score, hint]) => (
              <ScoreBar key={label} label={label} score={score} hint={score === null ? 'Needs the AI interviewer to score' : hint} />
            ))}
          </div>
          {ev.generatedBy === 'local' ? (
            <p className="mt-4 text-xs text-ink-faint">The AI interviewer wasn’t available, so this score comes from the tests only.</p>
          ) : null}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Complexity" />
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">You said</dt>
              <dd className="text-right text-ink">{ev.complexity.stated || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Your code</dt>
              <dd className="text-right font-mono text-ink">
                {ev.complexity.estimatedTime ? `${ev.complexity.estimatedTime} time, ${ev.complexity.estimatedSpace} space` : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-3">
              <dt className="text-ink-muted">Optimal</dt>
              <dd className="text-right font-mono text-ink">
                {PROBLEMS.find((p) => p.id === attempt.problemId)?.expectedComplexity.time} time
              </dd>
            </div>
          </dl>
          {ev.complexity.isOptimal === true ? <Badge tone="good" className="mt-4">Optimal</Badge> : ev.complexity.isOptimal === false ? <Badge tone="warn" className="mt-4">Can be faster</Badge> : null}
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-emerald-400/20">
          <CardHeader title="What went well" />
          <ul className="mt-4 space-y-2.5">
            {(ev.strengths.length ? ev.strengths : ['Keep practising: strengths show up once more tests pass.']).map((s) => (
              <li key={s} className="flex gap-2.5 text-[15px] text-ink-soft">
                <IconCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                {s}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="border-rose-400/20">
          <CardHeader title="What to work on" />
          <ul className="mt-4 space-y-2.5">
            {(ev.improvements.length ? ev.improvements : ['Nothing major stood out.']).map((s) => (
              <li key={s} className="flex gap-2.5 text-[15px] text-ink-soft">
                <IconTarget className="mt-1 h-4 w-4 shrink-0 text-rose-300" />
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Your code" subtitle={ev.codeComments.length ? 'Comments are pinned to the lines they’re about.' : 'Final submitted version.'} />
        <div className="mt-5">
          <AnnotatedCode code={attempt.code} comments={ev.codeComments} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Tests" subtitle="Hidden tests show only their name, like in a real assessment." />
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {(run.results || []).map((r) => (
            <li key={r.index} className="flex items-center gap-2 rounded-xl border border-line bg-inset/60 px-3 py-2 text-sm">
              <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold', r.passed ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200')}>
                {r.passed ? '✓' : '✕'}
              </span>
              <span className="truncate text-ink-soft">{r.hidden ? `Hidden${r.label ? `: ${r.label}` : ''}` : `Example ${r.index + 1}`}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-brand-400/25">
        <CardHeader
          title="The optimal approach"
          subtitle="Try the problem again before you read this. It sticks better."
          action={
            <button type="button" onClick={() => setShowOptimal((v) => !v)} aria-expanded={showOptimal} className="text-sm font-semibold text-brand-300 hover:text-brand-200">
              {showOptimal ? 'Hide' : 'Show'}
            </button>
          }
        />
        {showOptimal ? <p className="mt-4 animate-rise text-[15px] leading-relaxed text-ink">{ev.optimalApproach}</p> : null}
      </Card>

      {attempt.messages?.length ? (
        <Card>
          <CardHeader
            title="Conversation"
            action={
              <button type="button" onClick={() => setShowChat((v) => !v)} aria-expanded={showChat} className="text-sm font-semibold text-brand-300 hover:text-brand-200">
                {showChat ? 'Hide' : `Show ${attempt.messages.length} messages`}
              </button>
            }
          />
          {showChat ? (
            <div className="mt-4 space-y-2.5">
              {attempt.messages.map((m, i) => (
                <p key={i} className="text-sm">
                  <span className={cx('font-semibold', m.role === 'candidate' ? 'text-brand-300' : 'text-ink')}>{m.role === 'candidate' ? 'You' : 'Interviewer'}: </span>
                  <span className="text-ink-soft">{m.content}</span>
                </p>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <ButtonLink to={`/coding/${attempt.problemId}?lang=${attempt.language}`} size="lg">
          Try it again
        </ButtonLink>
        <ButtonLink to={`/coding/${nextProblem.id}?lang=${attempt.language}`} variant="secondary" size="lg">
          Next: {nextProblem.title} <IconArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </div>
  )
}
