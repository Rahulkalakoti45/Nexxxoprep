import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BehaviorReportSection from '../features/behavior/BehaviorReportSection.jsx'
import AnswerReviewSection from '../features/report/AnswerReviewSection.jsx'
import { getSession } from '../services/backend/sessionsApi.js'
import { mapSessionToReport } from '../utils/reportMapper.js'
import { formatMinutes } from '../utils/formatDuration.js'
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ScoreBar, ScoreRing, Skeleton } from '../components/ui/index.jsx'
import { scoreTone } from '../components/ui/helpers.js'
import { IconArrowRight, IconCheck, IconClock, IconLayers, IconMic, IconSparkle, IconTarget } from '../components/ui/icons.jsx'

// Placeholder text the grounded summary uses when it had nothing to say; never shown as a finding.
const NOT_FINDINGS = new Set(['not evaluated', 'insufficient evidence'])
const realItems = (items) => (items || []).filter((item) => item && !NOT_FINDINGS.has(String(item).trim().toLowerCase()))

function levelFor(score) {
  if (score >= 85) return 'Strong'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Developing'
  return 'Early days'
}

function headlineFor(score) {
  if (score >= 85) return 'Interview-ready on this one.'
  if (score >= 70) return 'Solid. A few answers away from great.'
  if (score >= 50) return 'Good foundation. Clear things to sharpen.'
  return 'Every expert started here. Here’s what to fix first.'
}

function ReportSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading report">
      <Skeleton className="h-56 w-full rounded-3xl" />
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

function ReportStateMessage({ title, message }) {
  return (
    <EmptyState
      icon={<IconLayers />}
      title={title}
      body={message}
      action={
        <ButtonLink to="/dashboard" variant="secondary">
          Back to home
        </ButtonLink>
      }
    />
  )
}

function FindingList({ title, items, tone, icon, empty }) {
  const styles = {
    good: { ring: 'border-emerald-400/20', icon: 'bg-emerald-400/15 text-emerald-300' },
    bad: { ring: 'border-rose-400/20', icon: 'bg-rose-400/15 text-rose-300' },
  }[tone]
  return (
    <Card className={styles.ring}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${styles.icon}`}>{icon}</span>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
      </div>
      {items.length ? (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'good' ? 'bg-emerald-400' : 'bg-rose-400'}`} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">{empty}</p>
      )}
    </Card>
  )
}

function DeliveryTile({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-line bg-inset/60 p-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

/** Per-question card for the classic (typed) interview mode. */
function ClassicAnswerCard({ entry }) {
  const missing =
    entry.question.expectedKeywords
      ?.filter((kw) => !(entry.feedback.meta?.domainTerms || []).some((m) => m.toLowerCase().includes(kw.toLowerCase())))
      .slice(0, 3) || []
  return (
    <article className="rounded-2xl border border-line bg-inset/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">
            {entry.question.roundName ? `${entry.question.roundName} · ` : ''}
            {entry.question.domain}
          </p>
          <p className="mt-1 font-semibold text-ink">{entry.question.question}</p>
        </div>
        <ScoreRing score={entry.feedback.score} size={52} stroke={5} />
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">You said</p>
          <p className="mt-1.5 whitespace-pre-wrap text-ink-soft">{entry.answer || '(skipped)'}</p>
        </div>
        <div className="space-y-2 rounded-xl border border-line bg-surface p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Feedback</p>
          <p className="text-ink-soft">{entry.feedback.suggestions?.[0] || 'No specific suggestion.'}</p>
          {missing.length ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-ink-muted">Missing:</span>
              {missing.map((kw) => (
                <Badge key={kw} tone="warn">
                  {kw}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function ReportPage() {
  const { sessionId } = useParams()
  const [status, setStatus] = useState(sessionId ? 'loading' : 'no_session')
  const [activeReport, setActiveReport] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    if (!sessionId) {
      setStatus('no_session')
      setActiveReport(null)
      return
    }

    let cancelled = false
    setStatus('loading')
    setActiveReport(null)
    setErrorMessage(null)

    getSession(sessionId)
      .then((session) => {
        if (cancelled) return
        const report = mapSessionToReport(session)
        if (!report) {
          setStatus('not_found')
          return
        }
        setActiveReport(report)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMessage(err?.message || 'Failed to load this report.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (status === 'no_session') {
    return <ReportStateMessage title="Pick an interview to review" message="Open any past interview from your home page to see its report." />
  }
  if (status === 'loading') return <ReportSkeleton />
  if (status === 'not_found') {
    return <ReportStateMessage title="Your report is still being written" message="This usually takes under a minute after the interview ends. Refresh in a moment." />
  }
  if (status === 'error') {
    return <ReportStateMessage title="We couldn’t load this report" message={errorMessage} />
  }

  const report = activeReport
  const score = report.overallScore ?? 0
  const domains = (report.domainBreakdown || []).slice().sort((a, b) => b.avgScore - a.avgScore)
  const strengths = realItems(report.strengthsSummary)
  const weaknesses = realItems(report.weaknessSummary)
  const nextSteps = realItems(report.roadmap?.dailyPlan)
  const patterns = report.patternAnalysis || {}
  const fillers = report.intelligence?.patternAnalysis?.fillerWordsDetected ?? 0
  const reviews = report.questionReviews || []
  const needsWork = reviews.filter((r) => r.verdict === 'weak').length
  const createdAt = report.createdAt ? new Date(report.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <IconArrowRight className="h-4 w-4 rotate-180" /> Home
      </Link>

      {/* Hero: the score, what it means, and the facts of the interview. */}
      <section className="relative overflow-hidden rounded-3xl border border-line-strong bg-gradient-to-br from-raised via-surface to-surface p-6 shadow-card sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center">
          <div className="flex justify-center md:block">
            <ScoreRing score={score} size={168} stroke={12} label="overall" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={scoreTone(score)}>{report.level || levelFor(score)}</Badge>
              {createdAt ? <span className="text-xs text-ink-muted">{createdAt}</span> : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">{headlineFor(score)}</h1>
            <p className="mt-2 text-ink-muted">
              {report.config.role} · {report.config.company} · {report.config.difficulty}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-inset px-3 py-1.5 text-ink-soft">
                <IconClock className="h-4 w-4 text-ink-faint" /> {formatMinutes(report.durationSeconds)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-inset px-3 py-1.5 text-ink-soft">
                <IconMic className="h-4 w-4 text-ink-faint" /> {report.questionCount ?? report.answers.length} questions answered
              </span>
              {needsWork ? (
                <a href="#answers" className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-rose-100 hover:bg-rose-400/15">
                  <IconTarget className="h-4 w-4" /> {needsWork} {needsWork === 1 ? 'answer' : 'answers'} to work on
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <FindingList title="What went well" items={strengths} tone="good" icon={<IconCheck className="h-4 w-4" />} empty="Not enough was said to call out strengths yet." />
        <FindingList title="What to work on" items={weaknesses} tone="bad" icon={<IconTarget className="h-4 w-4" />} empty="Nothing major stood out." />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Score by topic" subtitle="How each area of the interview went." />
          <div className="mt-5 space-y-4">
            {domains.length ? (
              domains.map((d) => <ScoreBar key={d.domain} label={d.domain} score={d.avgScore} hint={d.count > 1 ? `${d.count} questions` : null} />)
            ) : (
              <p className="text-sm text-ink-muted">Topic scores weren’t available for this interview.</p>
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="How you spoke" subtitle="Measured from your transcript." />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <DeliveryTile label="Avg answer" value={`${patterns.averageAnswerLength ?? 0}`} hint="words · aim for 60–120" />
            <DeliveryTile label="Filler words" value={fillers} hint="um, like, basically…" />
            <DeliveryTile label="Hedged answers" value={`${patterns.hesitationScore ?? 0}%`} hint="“maybe”, “I think”, “not sure”" />
            <DeliveryTile label="Consistency" value={`${patterns.consistencyScore ?? 0}%`} hint="steady answer length" />
          </div>
        </Card>
      </div>

      <div id="answers" className="scroll-mt-24">
        <AnswerReviewSection reviews={reviews} />
      </div>

      {report.answers?.length ? (
        <Card>
          <CardHeader title="Question by question" subtitle="Every answer with its score and feedback." />
          <div className="mt-5 space-y-4">
            {report.answers.map((entry) => (
              <ClassicAnswerCard key={entry.question.id} entry={entry} />
            ))}
          </div>
        </Card>
      ) : null}

      <BehaviorReportSection behavior={report.behavior} />

      <section className="relative overflow-hidden rounded-3xl border border-brand-400/25 bg-gradient-to-br from-brand-500/15 via-surface to-surface p-6 shadow-card sm:p-8">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
          <IconSparkle className="h-3.5 w-3.5" /> Before your next interview
        </p>
        {nextSteps.length ? (
          <ol className="mt-3 space-y-3">
            {nextSteps.slice(0, 5).map((item, index) => (
              <li key={item} className="flex gap-3 text-[15px] text-ink-soft">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/20 text-xs font-semibold text-brand-200">{index + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-ink-soft">Review the answers marked “Needs work” above, then try them again out loud.</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink to="/setup" size="lg">
            <IconMic className="h-4 w-4" /> Practise again
          </ButtonLink>
          <ButtonLink to="/dashboard" variant="secondary" size="lg">
            See my progress
          </ButtonLink>
        </div>
        <p className="mt-4 text-xs text-ink-faint">Your next interview will come back to the topics you found hardest here.</p>
      </section>
    </div>
  )
}
