export default function ConfidenceMeter({ lastScore }) {
  const score = Number.isFinite(lastScore) ? lastScore : null
  const percent = score == null ? 50 : Math.max(15, Math.min(95, score))
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111620] p-4">
      <p className="text-sm font-semibold text-slate-100">Confidence Meter</p>
      <div className="mt-3 h-2 w-full rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-emerald-300 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-400">{score == null ? 'Baseline' : `Last answer score: ${score}%`}</p>
    </div>
  )
}

