export default function RoundTracker({ rounds = [], currentRoundIndex = 0, answers = {}, onSelectRound }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111620] p-4">
      <p className="text-sm font-semibold text-slate-100">Round Tracker</p>
      <div className="mt-3 space-y-2">
        {rounds.map((round, idx) => {
          const total = round.questionIds?.length || 0
          const answered = (round.questionIds || []).filter((id) => Boolean(answers[id])).length
          const isActive = idx === currentRoundIndex
          const isComplete = total > 0 && answered >= total
          const pct = total ? Math.round((answered / total) * 100) : 0
          return (
            <button
            key={round.id}
            type="button"
            onClick={() => onSelectRound?.(idx)}
            disabled={!isActive && idx > currentRoundIndex}
            className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
              isActive
                ? 'border-slate-200 bg-slate-100 text-slate-900'
                : 'border-white/10 bg-black/20 text-slate-200 hover:bg-white/5'
            } ${!isActive && idx > currentRoundIndex ? 'cursor-not-allowed opacity-60 hover:bg-black/20' : ''}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span>
                {idx + 1}. {round.label}
              </span>
              <span className="text-[11px] opacity-80">
                {isComplete ? '✓' : ''} {answered}/{total} • {pct}%
              </span>
            </div>
          </button>
          )
        })}
      </div>
    </div>
  )
}

