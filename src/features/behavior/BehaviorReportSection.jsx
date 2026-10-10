import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const SIGNAL_LABELS = {
  posture: 'Posture',
  movement: 'Head stability',
  eyeContact: 'Eye contact',
  expression: 'Expression',
  gesture: 'Gestures',
}

const TREND_STYLES = {
  improving: 'text-emerald-300',
  declining: 'text-amber-300',
  stable: 'text-slate-300',
  'insufficient data': 'text-slate-500',
}

const SEVERITY_STYLES = {
  high: 'bg-red-500/15 text-red-200',
  medium: 'bg-amber-500/15 text-amber-100',
  low: 'bg-slate-500/20 text-slate-300',
}

const formatScore = (value) => (value == null ? '—' : value.toFixed(1))

function formatClock(seconds) {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function Stat({ label, value, suffix }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">
        {value}
        {suffix ? <span className="ml-1 text-sm font-normal text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  )
}

/**
 * Behavior Analysis block of the interview report. `behavior` comes from mapBehaviorReport()
 * and is null when the camera was never enabled for the interview.
 */
export default function BehaviorReportSection({ behavior }) {
  if (!behavior) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <h3 className="text-xl font-semibold">Behavior Analysis</h3>
        <p className="mt-2 text-sm text-slate-400">
          Not recorded for this interview. Allow camera access during an interview to get posture, eye-contact and
          engagement feedback here.
        </p>
      </section>
    )
  }

  const { scores, percentages, trends, events } = behavior
  const chartData = scores
    ? ['posture', 'movement', 'eyeContact', 'expression', ...(behavior.gestureObserved ? ['gesture'] : [])].map((key) => ({
        signal: SIGNAL_LABELS[key],
        score: scores[key] ?? 0,
      }))
    : []
  const detailRows = percentages
    ? [
        ['Looking at the camera', percentages.atCameraGazePct],
        ['Upright posture', percentages.uprightPosturePct],
        ['Steady head and shoulders', percentages.stableMovementPct],
        ['Smiling', percentages.smilingPct],
        ['Face in frame', percentages.faceVisiblePct],
      ].filter(([, value]) => typeof value === 'number')
    : []
  const trendRows = trends
    ? [
        ['Posture', trends.posture],
        ['Eye contact', trends.eyeContact],
        ['Overall', trends.overall],
      ].filter(([, value]) => value)
    : []

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Behavior Analysis</h3>
          <p className="mt-1 text-sm text-slate-400">
            {behavior.source === 'browser' ? 'Measured on your device from your webcam' : 'Measured by the Behavior Engine'}
            {behavior.durationSeconds ? ` · ${formatClock(behavior.durationSeconds)} analysed` : ''}
          </p>
        </div>
        {behavior.strongestSignal && behavior.weakestSignal ? (
          <p className="text-sm text-slate-300">
            Strongest: <span className="text-emerald-300">{SIGNAL_LABELS[behavior.strongestSignal] ?? behavior.strongestSignal}</span>
            {' · '}
            Work on: <span className="text-amber-300">{SIGNAL_LABELS[behavior.weakestSignal] ?? behavior.weakestSignal}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Behavior score" value={formatScore(behavior.overall)} suffix="/ 10" />
        <Stat label="Engagement" value={formatScore(behavior.engagement)} suffix="/ 10" />
        <Stat label="Attention" value={formatScore(behavior.attention)} suffix="/ 10" />
        <Stat label="Warnings" value={behavior.warningCount ?? '—'} />
      </div>

      {chartData.length ? (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Signal scores</p>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="signal" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" domain={[0, 10]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            {detailRows.length ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Share of the interview</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {detailRows.map(([label, value]) => (
                    <li key={label}>
                      <div className="flex justify-between text-slate-300">
                        <span>{label}</span>
                        <span>{Math.round(value)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-slate-200" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {trendRows.length ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Trend through the interview</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {trendRows.map(([label, value]) => (
                    <li key={label} className="flex justify-between">
                      <span className="text-slate-300">{label}</span>
                      <span className={TREND_STYLES[value] ?? 'text-slate-300'}>{value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {events.length ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Moments worth a look</p>
          <ul className="mt-3 space-y-2 text-sm">
            {events.slice(0, 8).map((event, index) => (
              <li key={`${event.time}-${event.type}-${index}`} className="flex items-start gap-3">
                <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-slate-500">{formatClock(event.time)}</span>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.low}`}>
                  {event.type}
                </span>
                <span className="text-slate-300">{event.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {behavior.partial ? (
        <p className="mt-4 text-xs text-amber-200/80">
          The final save did not complete, so these numbers cover only the part of the interview captured before it.
        </p>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">
        {behavior.source === 'browser'
          ? 'Estimated from face, pose and hand landmarks on your device; your video is never uploaded. '
          : ''}
        Indicative only &mdash; lighting, camera angle and framing change the numbers.
      </p>
    </section>
  )
}
