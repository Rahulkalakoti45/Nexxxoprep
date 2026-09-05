import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
} from 'recharts'
import useInterview from '../hooks/useInterview.js'
import { getUserAnalytics } from '../services/backend/analyticsApi.js'

function safeAvg(values) {
  if (!values.length) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function computeDomainTotals(reports) {
  const domains = {}
  for (const report of reports) {
    const breakdown = report.domainBreakdown || []
    for (const d of breakdown) {
      if (!domains[d.domain]) domains[d.domain] = { domain: d.domain, total: 0, count: 0 }
      domains[d.domain].total += d.avgScore ?? 0
      domains[d.domain].count += 1
    }
  }
  return Object.values(domains).map((d) => ({ domain: d.domain, avgScore: d.count ? Math.round(d.total / d.count) : 0 }))
}

export default function DashboardPage() {
  const { user, reports, resume, reportsLoading, reportsError, refreshReports, backendStatus } = useInterview()
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setAnalyticsLoading(true)
    getUserAnalytics(user.id)
      .then((snapshot) => {
        if (!cancelled) setAnalytics(snapshot)
      })
      .catch(() => {
        if (!cancelled) setAnalytics(null)
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, reports.length])

  const trendFromApi =
    analytics?.performanceTrend?.map((item, idx) => ({
      name: `Attempt ${idx + 1}`,
      score: item.score,
    })) || []

  const chartData =
    trendFromApi.length > 0
      ? trendFromApi
      : reports
          .slice()
          .reverse()
          .map((report, idx) => ({
            name: `Attempt ${idx + 1}`,
            score: report.overallScore,
          }))

  const avgScore =
    analytics?.averageOverallScore || safeAvg(reports.map((r) => r.overallScore))
  const bestScore = reports.length
    ? Math.max(...reports.map((r) => r.overallScore), analytics?.averageOverallScore || 0)
    : analytics?.averageOverallScore || 0
  const totalTimePracticed = reports.reduce((sum, r) => sum + (r.durationSeconds || 0), 0)

  const domainTotals = computeDomainTotals(reports)
  const apiWeakAreas = analytics?.weakAreas || []
  const weakAreas =
    apiWeakAreas.length > 0
      ? apiWeakAreas.map((w) => ({ domain: w.domain, avgScore: w.averageScore }))
      : domainTotals
          .slice()
          .sort((a, b) => a.avgScore - b.avgScore)
          .slice(0, 3)

  const weakestDomain = weakAreas[0]?.domain || '--'
  const recentWeakDomains = weakAreas.map((w) => w.domain)

  const domainPie = ['DSA', 'System Design', 'HR', 'Resume'].map((domain) => {
    const fromReports = domainTotals.find((d) => d.domain === domain)
    const fromApi = apiWeakAreas.find((d) => d.domain === domain)
    return {
      name: domain,
      value: fromReports?.avgScore ?? fromApi?.averageScore ?? 0,
    }
  })

  const resumeScore = resume?.analysis?.resumeScore ?? null
  const missingSkills = resume?.analysis?.missingSkills?.slice(0, 7) ?? []
  const resumeTips = resume?.analysis?.improvementSuggestions?.slice(0, 3) ?? []
  const readinessScore = analytics?.interviewCount
    ? Math.round((avgScore + (analytics.averageCommunicationScore || 0) + (analytics.averageTechnicalScore || 0)) / 3)
    : reports.length
      ? Math.round((avgScore + (resumeScore || 0)) / 2)
      : 0
  const sessionsCompleted = analytics?.interviewCount ?? reports.length
  const aiRecommendation = analytics?.interviewCount
    ? `Completed ${analytics.interviewCount} sessions. Prioritize ${weakestDomain} (${weakAreas[0]?.avgScore ?? weakAreas[0]?.averageScore ?? 0}% avg).`
    : reports.length
      ? `You have ${reports.length} saved report(s). Complete another session to unlock trend analytics.`
      : 'Complete your first interview to unlock database-backed analytics.'

  const radarData = ['DSA', 'System Design', 'HR', 'Resume', 'Backend'].map((domain) => ({
    domain,
    value:
      domainTotals.find((d) => d.domain === domain)?.avgScore ??
      apiWeakAreas.find((d) => d.domain === domain)?.averageScore ??
      (domain === 'Resume' ? resumeScore || 55 : 45),
  }))

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Welcome back, {user?.name}</h2>
            <p className="mt-2 text-slate-400">
              Build confidence with adaptive interview practice. Data syncs from PostgreSQL via the API.
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>API: {backendStatus === 'connected' ? 'connected' : backendStatus}</p>
            <button
              type="button"
              onClick={() => refreshReports()}
              className="mt-1 rounded border border-white/15 px-2 py-1 text-slate-200 hover:bg-white/5"
            >
              Refresh data
            </button>
          </div>
        </div>

        {(reportsLoading || analyticsLoading) && (
          <p className="mt-3 text-sm text-slate-400">Loading live analytics…</p>
        )}
        {reportsError && <p className="mt-3 text-sm text-red-300">{reportsError}</p>}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="rounded-lg bg-slate-100 px-4 py-2 text-slate-900" to="/resume">
            {resume ? 'Update Resume Data' : 'Upload Resume'}
          </Link>
          <Link className="rounded-lg border border-white/20 px-4 py-2 text-slate-100" to="/setup">
            Start Interview Setup
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-5">
        <article className="rounded-xl border border-white/10 bg-[#111620] p-5 transition hover:bg-white/5">
          <p className="text-sm text-slate-400">Avg Score</p>
          <h3 className="mt-2 text-3xl font-semibold">{chartData.length || analytics ? `${avgScore}%` : '--'}</h3>
        </article>
        <article className="rounded-xl border border-white/10 bg-[#111620] p-5 transition hover:bg-white/5">
          <p className="text-sm text-slate-400">Best Score</p>
          <h3 className="mt-2 text-3xl font-semibold">{chartData.length || analytics ? `${bestScore}%` : '--'}</h3>
        </article>
        <article className="rounded-xl border border-white/10 bg-[#111620] p-5 transition hover:bg-white/5">
          <p className="text-sm text-slate-400">Weakest Domain</p>
          <h3 className="mt-2 text-3xl font-semibold">{weakAreas.length ? weakestDomain : '--'}</h3>
        </article>
        <article className="rounded-xl border border-white/10 bg-[#111620] p-5 transition hover:bg-white/5">
          <p className="text-sm text-slate-400">Total Time Practiced</p>
          <h3 className="mt-2 text-3xl font-semibold">
            {reports.length ? `${Math.round(totalTimePracticed / 60)} min` : analytics?.interviewCount ? '—' : '--'}
          </h3>
        </article>
      </section>

      <section className="grid grid-cols-4 gap-5">
        <article className="rounded-xl border border-white/10 bg-[#111620] p-5">
          <p className="text-sm text-slate-400">Sessions Completed</p>
          <h3 className="mt-2 text-3xl font-semibold">{sessionsCompleted}</h3>
        </article>
        <article className="rounded-xl border border-white/10 bg-[#111620] p-5">
          <p className="text-sm text-slate-400">Interview Readiness</p>
          <h3 className="mt-2 text-3xl font-semibold">{chartData.length || analytics ? `${readinessScore}%` : '--'}</h3>
        </article>
        <article className="col-span-2 rounded-xl border border-white/10 bg-[#111620] p-5">
          <p className="text-sm text-slate-400">AI Recommendation</p>
          <p className="mt-2 text-slate-200">{aiRecommendation}</p>
          <p className="mt-1 text-xs text-slate-500">Recent weak domains: {recentWeakDomains.join(', ') || '--'}</p>
        </article>
      </section>

      <section className="grid grid-cols-3 gap-5">
        <section className="col-span-2 rounded-2xl border border-white/10 bg-[#111620] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Interview Score Trend</h2>
            <p className="text-xs text-slate-400">From database analytics</p>
          </div>
          <div className="mt-4 h-72 w-full rounded-xl border border-white/10 bg-black/20 p-3">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#e2e8f0" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No interviews completed yet. Your score trend will appear here.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
          <h2 className="text-xl font-semibold">Domain Performance</h2>
          <p className="mt-1 text-xs text-slate-400">Average scores by domain</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={domainPie} dataKey="value" nameKey="name" outerRadius={90} fill="#e2e8f0" />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </section>

      <section className="grid grid-cols-2 gap-5">
        <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
          <h2 className="text-xl font-semibold">Skill Radar</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="domain" stroke="#94a3b8" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#64748b" />
                <Radar name="Skills" dataKey="value" stroke="#e2e8f0" fill="#e2e8f0" fillOpacity={0.25} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
          <h2 className="text-xl font-semibold">Improvement Trajectory</h2>
          <p className="mt-2 text-sm text-slate-400">Score progression from stored session reports.</p>
          <div className="mt-4 h-72 w-full rounded-xl border border-white/10 bg-black/20 p-3">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#e2e8f0" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">Complete interviews to visualize your trajectory.</p>
            )}
          </div>
        </section>
      </section>

      <section className="grid grid-cols-3 gap-5">
        <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
          <h2 className="text-xl font-semibold">Weak Areas</h2>
          <p className="mt-1 text-xs text-slate-400">From analytics service</p>
          {weakAreas.length ? (
            <div className="mt-4 space-y-3">
              {weakAreas.map((d) => (
                <div key={d.domain} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-100">{d.domain}</p>
                    <p className="text-sm text-slate-200">{d.avgScore ?? d.averageScore}%</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Tip: practice 3 questions/day and review patterns.</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-slate-400">Complete an interview to see weak area insights.</p>
          )}
        </section>

        <section className="col-span-2 rounded-2xl border border-white/10 bg-[#111620] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Resume Insights</h2>
            <Link className="text-sm text-slate-200 underline-offset-4 hover:underline" to="/resume">
              Open Resume
            </Link>
          </div>
          {resume ? (
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Resume Score</p>
                <p className="mt-2 text-3xl font-semibold">{resumeScore ?? '--'}%</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Missing Skills</p>
                <p className="mt-2 text-sm text-slate-200">{missingSkills.length ? missingSkills.join(', ') : '--'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Improvement Tips</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                  {resumeTips.length ? resumeTips.map((t) => <li key={t}>{t}</li>) : <li>Paste resume text to generate tips.</li>}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-slate-400">Upload/analyze your resume to unlock resume insights.</p>
          )}
        </section>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <h2 className="text-xl font-semibold">Past Interviews</h2>
        {reports.length ? (
          <div className="mt-4 space-y-3">
            {reports.map((report) => {
              const row = (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4 transition hover:bg-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-300">
                      {report.config?.role || '—'} - {report.config?.company || '—'} - {report.config?.difficulty || '—'}
                    </p>
                    <p className="font-semibold">{report.overallScore}%</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(report.createdAt).toLocaleString()}
                    {report.durationSeconds ? ` | Duration: ${Math.round(report.durationSeconds / 60)} min` : ''}
                    {report.backendSessionId ? ' | synced' : ''}
                  </p>
                </div>
              )

              return report.backendSessionId ? (
                <Link key={report.id} to={`/report/${report.backendSessionId}`} className="block">
                  {row}
                </Link>
              ) : (
                <div key={report.id}>{row}</div>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-slate-400">No past interviews yet.</p>
        )}
      </section>
    </div>
  )
}
