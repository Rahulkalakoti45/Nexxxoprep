import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useInterview from '../hooks/useInterview.js'
import { getUserAnalytics } from '../services/backend/analyticsApi.js'
import { getUserProgress } from '../services/backend/reportsApi.js'
import { formatMinutes } from '../utils/formatDuration.js'
import WeakSpotProgressPanel from '../features/report/WeakSpotProgressPanel.jsx'
import { listCodingAttempts } from '../features/coding/interviewer.js'
import { loadAttempts } from '../features/coding/attemptSync.js'
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ScoreBar, ScoreRing, StatTile } from '../components/ui/index.jsx'
import { chartTheme, cx, scoreTone } from '../components/ui/helpers.js'
import {
  IconArrowRight,
  IconChart,
  IconCode,
  IconCheck,
  IconClock,
  IconFile,
  IconLayers,
  IconMic,
  IconSparkle,
  IconTrendUp,
} from '../components/ui/icons.jsx'

function safeAvg(values) {
  if (!values.length) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function computeDomainTotals(reports) {
  const domains = {}
  for (const report of reports) {
    for (const d of report.domainBreakdown || []) {
      if (!domains[d.domain]) domains[d.domain] = { domain: d.domain, total: 0, count: 0 }
      domains[d.domain].total += d.avgScore ?? 0
      domains[d.domain].count += 1
    }
  }
  return Object.values(domains).map((d) => ({ domain: d.domain, avgScore: d.count ? Math.round(d.total / d.count) : 0 }))
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Up late'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function shortDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** The one thing this person should do next, in order: resume, first interview, then focus areas. */
function NextStep({ hasResume, interviewCount, nextFocus }) {
  let eyebrow = 'Next step'
  let title
  let body
  let action

  if (!hasResume) {
    title = 'Add your resume so the interview is about you'
    body = 'The interviewer reads your projects and skills, then asks the follow-ups a real panel would. It takes a minute.'
    action = (
      <ButtonLink to="/resume" size="lg">
        <IconFile className="h-4 w-4" /> Add resume
      </ButtonLink>
    )
  } else if (!interviewCount) {
    title = 'Take your first practice interview'
    body = 'A voice conversation with an AI interviewer. You get answer-by-answer feedback the moment it ends.'
    action = (
      <ButtonLink to="/setup" size="lg">
        <IconMic className="h-4 w-4" /> Start interview
      </ButtonLink>
    )
  } else if (nextFocus.length) {
    eyebrow = 'Your next interview'
    title = `We'll come back to ${nextFocus.map((f) => f.topic).slice(0, 2).join(' and ')}`
    body = 'These scored lowest last time. Practising them again is the fastest way to raise your score.'
    action = (
      <ButtonLink to="/setup" size="lg">
        <IconMic className="h-4 w-4" /> Practise now
      </ButtonLink>
    )
  } else {
    title = 'Keep the streak going'
    body = 'Try a harder difficulty or a different company to stretch yourself.'
    action = (
      <ButtonLink to="/setup" size="lg">
        <IconMic className="h-4 w-4" /> New interview
      </ButtonLink>
    )
  }

  return (
    <div className="relative h-full overflow-hidden rounded-3xl border border-brand-400/25 bg-gradient-to-br from-brand-500/20 via-surface to-surface p-6 shadow-card sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
      <div className="relative">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
          <IconSparkle className="h-3.5 w-3.5" /> {eyebrow}
        </p>
        <h2 className="max-w-xl text-2xl font-semibold text-ink sm:text-[28px] sm:leading-tight">{title}</h2>
        <p className="mt-2 max-w-xl text-[15px] text-ink-muted">{body}</p>
        <div className="mt-6">{action}</div>
      </div>
    </div>
  )
}

function GettingStarted({ hasResume, interviewCount }) {
  const steps = [
    { done: hasResume, title: 'Add your resume', body: 'So questions are about your own projects.', to: '/resume' },
    { done: interviewCount > 0, title: 'Take a practice interview', body: 'A voice conversation, at your pace.', to: '/setup' },
    { done: false, title: 'Review your answers', body: 'See exactly what to say differently.', to: null },
  ]
  return (
    <Card>
      <CardHeader title="Getting started" subtitle="Three steps to your first feedback report." />
      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const body = (
            <div className="flex items-center gap-3">
              <span
                className={cx(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-semibold',
                  step.done ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200' : 'border-line-strong text-ink-muted',
                )}
              >
                {step.done ? <IconCheck className="h-4 w-4" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={cx('text-sm font-semibold', step.done ? 'text-ink-muted line-through decoration-ink-faint' : 'text-ink')}>{step.title}</p>
                <p className="text-xs text-ink-muted">{step.body}</p>
              </div>
            </div>
          )
          return (
            <li key={step.title}>
              {step.to && !step.done ? (
                <Link to={step.to} className="block rounded-xl border border-line bg-inset/60 p-3 transition hover:border-line-strong">
                  {body}
                </Link>
              ) : (
                <div className="rounded-xl border border-line bg-inset/60 p-3">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function InterviewRow({ report }) {
  const score = report.overallScore ?? 0
  const content = (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-inset/60 p-3.5 transition group-hover:border-line-strong group-hover:bg-white/[0.03]">
      <ScoreRing score={score} size={48} stroke={5} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">
          {report.config?.role || 'Interview'}
          <span className="font-normal text-ink-muted"> · {report.config?.company || 'General'}</span>
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {shortDate(report.createdAt)}
          {report.durationSeconds ? ` · ${formatMinutes(report.durationSeconds)}` : ''}
          {report.config?.difficulty ? ` · ${report.config.difficulty}` : ''}
        </p>
      </div>
      <span className="hidden sm:block">
        <Badge tone={scoreTone(score)}>{report.level || (score >= 85 ? 'Strong' : score >= 70 ? 'Good' : 'Developing')}</Badge>
      </span>
      {report.backendSessionId ? <IconArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink" /> : null}
    </div>
  )
  return report.backendSessionId ? (
    <Link to={`/report/${report.backendSessionId}`} className="group block">
      {content}
    </Link>
  ) : (
    <div className="group">{content}</div>
  )
}

export default function DashboardPage() {
  const { user, reports, resume, reportsLoading, reportsError, refreshReports } = useInterview()
  const [analytics, setAnalytics] = useState(null)
  const [nextFocus, setNextFocus] = useState([])
  const [codingAttempts, setCodingAttempts] = useState(() => listCodingAttempts())

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    getUserAnalytics(user.id)
      .then((snapshot) => !cancelled && setAnalytics(snapshot))
      .catch(() => !cancelled && setAnalytics(null))
    loadAttempts(user.id).then((result) => !cancelled && setCodingAttempts(result.attempts))
    getUserProgress(user.id)
      .then((progress) => !cancelled && setNextFocus(progress?.nextFocus || []))
      .catch(() => !cancelled && setNextFocus([]))
    return () => {
      cancelled = true
    }
  }, [user?.id, reports.length])

  const ordered = reports.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const chartData = ordered.map((report, idx) => ({ name: shortDate(report.createdAt) || `#${idx + 1}`, score: report.overallScore }))

  const interviewCount = analytics?.interviewCount ?? reports.length
  const avgScore = reports.length ? safeAvg(reports.map((r) => r.overallScore)) : analytics?.averageOverallScore ?? null
  const bestScore = reports.length ? Math.max(...reports.map((r) => r.overallScore)) : null
  const totalSeconds = reports.reduce((sum, r) => sum + (r.durationSeconds || 0), 0)
  const firstScore = ordered[0]?.overallScore
  const lastScore = ordered[ordered.length - 1]?.overallScore
  const change = ordered.length > 1 ? lastScore - firstScore : null

  const domains = computeDomainTotals(reports).sort((a, b) => a.avgScore - b.avgScore).slice(0, 5)
  const hasResume = Boolean(resume)
  const resumeScore = resume?.analysis?.resumeScore ?? null
  const missingSkills = resume?.analysis?.missingSkills?.slice(0, 6) ?? []
  const firstName = (user?.name || '').split(/\s+/)[0]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">{greeting()},</p>
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{firstName || 'there'}</h1>
        </div>
        {reportsError ? (
          <button type="button" onClick={() => refreshReports()} className="text-sm text-rose-200 underline-offset-4 hover:underline">
            Couldn&apos;t load your interviews. Retry
          </button>
        ) : reportsLoading ? (
          <p className="text-sm text-ink-muted">Syncing…</p>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NextStep hasResume={hasResume} interviewCount={interviewCount} nextFocus={nextFocus} />
        </div>
        {interviewCount ? (
          <Card className="flex flex-col items-center justify-center text-center">
            <ScoreRing score={avgScore} size={150} label="avg score" />
            <p className="mt-4 text-sm text-ink-muted">
              {change === null ? (
                'Complete another interview to see your trend.'
              ) : (
                <>
                  <span className={change >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
                    {change >= 0 ? '+' : ''}
                    {change} pts
                  </span>{' '}
                  since your first interview
                </>
              )}
            </p>
          </Card>
        ) : (
          <GettingStarted hasResume={hasResume} interviewCount={interviewCount} />
        )}
      </div>

      {interviewCount ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Interviews" value={interviewCount} icon={<IconMic className="h-4 w-4" />} />
          <StatTile label="Best score" value={bestScore ?? '–'} icon={<IconTrendUp className="h-4 w-4" />} />
          <StatTile label="Time practised" value={reports.length ? formatMinutes(totalSeconds) : '–'} icon={<IconClock className="h-4 w-4" />} />
          <StatTile label="Resume score" value={resumeScore ?? '–'} hint={hasResume ? null : 'Add your resume'} icon={<IconFile className="h-4 w-4" />} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Score over time" subtitle="Your overall score in each interview." />
          <div className="mt-5 h-64">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartTheme.brand} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={chartTheme.brand} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="name" stroke={chartTheme.axis} tick={chartTheme.tick} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke={chartTheme.axis} tick={chartTheme.tick} tickLine={false} axisLine={false} />
                  <Tooltip {...chartTheme.tooltip} formatter={(v) => [`${v}`, 'Score']} />
                  <Area type="monotone" dataKey="score" stroke={chartTheme.brand} strokeWidth={2.5} fill="url(#scoreFill)" dot={{ r: 3, fill: chartTheme.brand, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<IconChart />}
                title={chartData.length ? 'One down, keep going' : 'Your progress shows up here'}
                body={chartData.length ? 'After your second interview you’ll see how your score is moving.' : 'Finish an interview to start your score line.'}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Focus areas" subtitle="Lowest-scoring topics across your interviews." />
          <div className="mt-5 space-y-4">
            {domains.length ? (
              domains.map((d) => <ScoreBar key={d.domain} label={d.domain} score={d.avgScore} />)
            ) : (
              <p className="text-sm text-ink-muted">Topic scores appear after your first interview.</p>
            )}
          </div>
        </Card>
      </div>

      <WeakSpotProgressPanel userId={user?.id} refreshKey={reports.length} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Past interviews"
            subtitle={reports.length ? 'Open any interview to review your answers.' : null}
            action={
              reports.length ? (
                <ButtonLink to="/setup" variant="secondary" size="sm">
                  New interview
                </ButtonLink>
              ) : null
            }
          />
          <div className="mt-5 space-y-2.5">
            {reports.length ? (
              reports.map((report) => <InterviewRow key={report.id} report={report} />)
            ) : (
              <EmptyState
                icon={<IconLayers />}
                title="No interviews yet"
                body="Your reports will be listed here, each with answer-by-answer feedback."
                action={
                  <ButtonLink to="/setup">
                    <IconMic className="h-4 w-4" /> Start your first
                  </ButtonLink>
                }
              />
            )}
          </div>
        </Card>

        <div className="space-y-5">
        <Card>
          <CardHeader
            title="Coding round"
            action={
              <Link to="/coding" className="text-sm font-medium text-brand-300 hover:text-brand-200">
                {codingAttempts.length ? 'Practise' : 'Try it'}
              </Link>
            }
          />
          {codingAttempts.length ? (
            <ul className="mt-4 space-y-2">
              {codingAttempts.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <Link to={`/coding/result/${a.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-inset/60 px-3 py-2 transition hover:border-line-strong">
                    <ScoreRing score={a.evaluation?.overall ?? 0} size={34} stroke={4} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.problemTitle}</span>
                    <span className="font-mono text-xs text-ink-faint">
                      {a.finalRun.passed}/{a.finalRun.total}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Link to="/coding" className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-line-strong p-3.5 text-sm text-ink-muted transition hover:border-brand-400/50 hover:text-ink">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
                <IconCode className="h-[18px] w-[18px]" />
              </span>
              Solve a problem in a real editor while an AI interviewer asks about your approach.
            </Link>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Resume"
            action={
              <Link to="/resume" className="text-sm font-medium text-brand-300 hover:text-brand-200">
                {hasResume ? 'Update' : 'Add'}
              </Link>
            }
          />
          {hasResume ? (
            <div className="mt-5 space-y-5">
              {resumeScore !== null ? <ScoreBar label="Resume score" score={resumeScore} /> : null}
              <div>
                <p className="text-sm font-medium text-ink-soft">Skills to add</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {missingSkills.length ? (
                    missingSkills.map((skill) => (
                      <Badge key={skill} tone="neutral">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-ink-muted">None flagged.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">Add your resume and the interviewer will ask about your real projects.</p>
          )}
        </Card>
        </div>
      </div>
    </div>
  )
}
