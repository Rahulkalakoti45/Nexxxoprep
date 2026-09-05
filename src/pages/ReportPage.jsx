import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getSession } from '../services/backend/sessionsApi.js'
import { mapSessionToReport } from '../utils/reportMapper.js'

function domainChartData(domainBreakdown) {
  const wanted = ['DSA', 'System Design', 'HR']
  return wanted.map((domain) => {
    const found = domainBreakdown?.find((item) => item.domain === domain)
    return { domain, score: found?.avgScore ?? 0 }
  })
}

function ReportStateMessage({ title, message, showBackLink = true }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111620] p-10 text-center">
      <p className="text-lg text-slate-200">{title}</p>
      {message ? <p className="mt-2 text-sm text-slate-400">{message}</p> : null}
      {showBackLink ? (
        <Link to="/dashboard" className="mt-5 inline-flex rounded-lg bg-slate-100 px-4 py-2 text-slate-900">
          Back to Dashboard
        </Link>
      ) : null}
    </div>
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
    return (
      <ReportStateMessage
        title="No interview selected."
        message="Choose a past interview from your Dashboard to view its report."
      />
    )
  }

  if (status === 'loading') {
    return <ReportStateMessage title="Loading your report…" showBackLink={false} />
  }

  if (status === 'not_found') {
    return (
      <ReportStateMessage
        title="No report found for this interview yet."
        message="The report may still be generating — try refreshing in a moment."
      />
    )
  }

  if (status === 'error') {
    return <ReportStateMessage title="Something went wrong loading this report." message={errorMessage} />
  }

  const domainBreakdown = activeReport.domainBreakdown || []
  const weakestDomains = activeReport.weakDomains || domainBreakdown.slice().sort((a, b) => a.avgScore - b.avgScore).slice(0, 2).map((d) => d.domain)

  const domainBars = domainChartData(domainBreakdown)
  const breakdownPie = domainBreakdown.map((d) => ({ name: d.domain, value: d.count }))
  const intelligence = activeReport.intelligence || {}
  const heatmap = intelligence.heatmap || {}

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold">Interview Report</h2>
            <p className="mt-2 text-slate-400">
              {activeReport.config.role} - {activeReport.config.company} - {activeReport.config.difficulty}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Final Score</p>
            <p className="mt-1 text-3xl font-semibold">{activeReport.overallScore}%</p>
            <p className="mt-1 text-sm text-slate-300">Level: {activeReport.level || '—'}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <article className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/5">
            <p className="text-sm text-slate-400">Recommendation</p>
            <p className="mt-2 text-sm text-slate-200">{activeReport.recommendation || 'Keep practicing and iterate.'}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/5">
            <p className="text-sm text-slate-400">Duration</p>
            <p className="mt-2 text-3xl font-semibold">{Math.round(activeReport.durationSeconds / 60)} min</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/5">
            <p className="text-sm text-slate-400">Questions</p>
            <p className="mt-2 text-3xl font-semibold">{activeReport.answers.length}</p>
          </article>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-5">
        <article className="rounded-2xl border border-white/10 bg-[#111620] p-5">
          <h3 className="text-lg font-semibold">Domain-wise Breakdown</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainBars}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="domain" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-400">Scores are derived from your per-question feedback.</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-[#111620] p-5">
          <h3 className="text-lg font-semibold">Weak Area Analysis</h3>
          <p className="mt-2 text-sm text-slate-400">
            Lowest scoring domains: <span className="text-slate-200">{weakestDomains.join(', ') || '—'}</span>
          </p>
          <div className="mt-4 space-y-3">
            {(activeReport.weaknessSummary || []).map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Improvement tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              <li>Use a 3-part structure (context → action → outcome) for every answer.</li>
              <li>Add 1 measurable result per answer (latency, users, revenue, time saved).</li>
              <li>Include 1 domain keyword to show signal (e.g., cache/latency for System Design).</li>
            </ul>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-2 gap-5">
        <article className="rounded-2xl border border-white/10 bg-[#111620] p-5">
          <h3 className="text-lg font-semibold">Answer Pattern Analysis</h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Avg length</p>
              <p className="mt-2 text-2xl font-semibold">{activeReport.patternAnalysis?.averageAnswerLength ?? 0} words</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Hesitation</p>
              <p className="mt-2 text-2xl font-semibold">{activeReport.patternAnalysis?.hesitationScore ?? 0}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Consistency</p>
              <p className="mt-2 text-2xl font-semibold">{activeReport.patternAnalysis?.consistencyScore ?? 0}%</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Hesitation derived from answer language patterns; behavior metrics sync to the analytics API when online.
          </p>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
            Hesitations: {intelligence.patternAnalysis?.hesitationWordsDetected ?? 0} • Fillers:{' '}
            {intelligence.patternAnalysis?.fillerWordsDetected ?? 0} • Skipped domains:{' '}
            {(intelligence.patternAnalysis?.skippedDomains || []).join(', ') || '--'}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-[#111620] p-5">
          <h3 className="text-lg font-semibold">Question Mix</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={breakdownPie} dataKey="value" nameKey="name" outerRadius={90} fill="#e2e8f0" />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-400">Distribution across domains in this interview.</p>
        </article>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <h3 className="text-xl font-semibold">Improvement Roadmap</h3>
        <div className="mt-4 grid grid-cols-2 gap-5">
          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Daily plan</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200">
              {(activeReport.roadmap?.dailyPlan || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Weekly goals</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200">
              {(activeReport.roadmap?.weeklyGoals || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Monthly goals</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200">
              {(activeReport.roadmap?.monthlyGoals || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Domain Heatmap</p>
            <p className="mt-2 text-sm text-slate-200">Strongest: {heatmap.strongestDomain || '--'}</p>
            <p className="text-sm text-slate-200">Weakest: {heatmap.weakestDomain || '--'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <h3 className="text-xl font-semibold">Question-Level Analysis</h3>
        <div className="mt-4 space-y-4">
          {activeReport.answers.map((entry) => (
            <article key={entry.question.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-100">{entry.question.question}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {entry.question.roundName ? `Round: ${entry.question.roundName} • ` : ''}
                    Domain: {entry.question.domain} • Type: {entry.question.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Score</p>
                  <p className="text-xl font-semibold">{entry.feedback.score}%</p>
                  <p className="mt-1 text-xs text-slate-400">Status: {entry.status || 'answered'}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-[#0a0f17] p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Clarity</p>
                  <p className="mt-1 text-lg font-semibold">{entry.feedback.clarityScore ?? '--'}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0a0f17] p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Confidence</p>
                  <p className="mt-1 text-lg font-semibold">{entry.feedback.confidenceScore ?? '--'}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0a0f17] p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Words</p>
                  <p className="mt-1 text-lg font-semibold">{entry.feedback.meta?.wordCount ?? 0}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-white/10 bg-[#0a0f17] p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Your answer</p>
                  <p className="mt-2 whitespace-pre-wrap text-slate-200">{entry.answer || '— (skipped)'}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0a0f17] p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Feedback</p>
                  <p className="mt-2 text-slate-200">{entry.feedback.suggestions?.[0] || '—'}</p>
                  <p className="mt-2 text-xs text-slate-400">Strength: {entry.feedback.strengths?.[0] || '—'}</p>
                  <p className="mt-1 text-xs text-slate-400">Weakness: {entry.feedback.weaknesses?.[0] || '—'}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Keywords matched: {(entry.feedback.meta?.domainTerms || []).join(', ') || '--'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Missing concepts:{' '}
                    {entry.question.expectedKeywords
                      ?.filter((kw) => !(entry.feedback.meta?.domainTerms || []).some((m) => m.toLowerCase().includes(kw.toLowerCase())))
                      .slice(0, 3)
                      .join(', ') || '--'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Follow-up recommendation: {entry.question.followUpQuestions?.[0] || 'Deepen with one extra trade-off.'}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {(activeReport.backendSessionId || activeReport.backendError) && (
        <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
          <h3 className="text-xl font-semibold">Backend Sync</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
            {activeReport.backendSessionId && (
              <li>Session persisted: {activeReport.backendSessionId}</li>
            )}
            {activeReport.backendReportId && <li>Report ID: {activeReport.backendReportId}</li>}
            {activeReport.backendError && <li className="text-yellow-200">{activeReport.backendError}</li>}
          </ul>
        </section>
      )}

      <Link to="/dashboard" className="inline-flex rounded-lg bg-slate-100 px-4 py-2 text-slate-900">
        Back to Dashboard
      </Link>
    </div>
  )
}
