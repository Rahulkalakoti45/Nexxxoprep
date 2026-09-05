export default function RoundTracker({ rounds = [], currentRoundIndex = 0 }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Round Tracker</h3>
      <ul className="space-y-2">
        {rounds.map((round, index) => (
          <li
            key={round.id}
            className={`rounded-lg border px-2 py-1 text-xs ${
              index === currentRoundIndex ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200'
            }`}
          >
            {index + 1}. {round.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
