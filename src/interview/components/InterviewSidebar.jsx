import RoundTracker from './RoundTracker.jsx'

export default function InterviewSidebar({ rounds, roundProgress, domainProgress, healthMeter, confidenceMeter, paceMeter, sparkline }) {
  const progressMap = domainProgress.map((domain) => {
    const totalAttempted = domain.answered + domain.doubtful + domain.skipped
    const pct = domain.total ? Math.round((totalAttempted / domain.total) * 100) : 0
    return { ...domain, pct }
  })

  return (
    <div className="space-y-4">
      <RoundTracker rounds={rounds} roundProgress={roundProgress} />

      <section className="rounded-2xl border border-white/10 bg-[#111620] p-4">
        <h3 className="text-lg font-semibold">Domain Tracker</h3>
        <div className="mt-3 space-y-2">
          {domainProgress.map((d) => (
            <div key={d.domain} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
              <div className="flex items-center justify-between"><span>{d.domain}</span><span>{d.answered + d.doubtful + d.skipped}/{d.total}</span></div>
              <div className="mt-1 flex gap-1">
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-100">A:{d.answered}</span>
                <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-100">D:{d.doubtful}</span>
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-100">S:{d.skipped}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111620] p-4">
        <h3 className="text-lg font-semibold">Progress Map</h3>
        <div className="mt-3 space-y-2">
          {progressMap.map((entry) => (
            <div key={`${entry.domain}-map`} className="text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>{entry.domain}</span>
                <span>{entry.pct}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-white/10">
                <div className="h-1.5 rounded-full bg-slate-200/90" style={{ width: `${entry.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111620] p-4">
        <h3 className="text-lg font-semibold">Live Stats</h3>
        <div className="mt-3 h-2 w-full rounded-full bg-white/10"><div className="h-2 rounded-full bg-emerald-300" style={{ width: `${healthMeter}%` }} /></div>
        <p className="mt-2 text-xs text-slate-400">Health: {healthMeter}%</p>
        <p className="text-xs text-slate-400">Confidence: {confidenceMeter}% - Pace: {paceMeter}%</p>
        <div className="mt-2 flex h-8 items-end gap-1">
          {sparkline.map((v, idx) => <div key={`${v}-${idx}`} className="w-3 rounded-t bg-slate-200/70" style={{ height: `${Math.max(10, v / 1.4)}%` }} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111620] p-4">
        <h3 className="text-lg font-semibold">Behavior Analysis (Coming Soon)</h3>
        <div className="mt-3 flex h-28 items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/20 text-sm text-slate-400">Webcam Placeholder</div>
      </section>
    </div>
  )
}
