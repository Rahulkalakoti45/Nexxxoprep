export default function RoundTracker({ rounds, roundProgress }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#111620] p-4">
      <h3 className="text-lg font-semibold">Round Tracker</h3>
      <div className="mt-3 space-y-2">
        {rounds.map((r) => {
          const info = roundProgress[r.roundName] || { done: 0, total: r.questions?.length || 0 }
          const pct = info.total ? Math.round((info.done / info.total) * 100) : 0
          return (
            <div key={r.roundName}>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{r.roundName}</span>
                <span>{info.done}/{info.total}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-white/10">
                <div className="h-1.5 rounded-full bg-slate-100" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
