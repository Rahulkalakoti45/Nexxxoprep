const modes = [
  { id: 'standard', title: 'Standard Interview', subtitle: 'Text + voice answers with structured rounds.', enabled: true },
  { id: 'ai_simulated', title: 'Conversational AI Interview', subtitle: 'Realtime voice conversation with AI interviewer.', enabled: true },
]

export default function InterviewModeSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          disabled={!mode.enabled}
          onClick={() => onChange(mode.id)}
          className={`rounded-2xl border p-4 text-left transition ${
            value === mode.id
              ? 'border-slate-200 bg-slate-100 text-slate-900'
              : 'border-white/10 bg-black/20 text-slate-100 hover:bg-white/5'
          } ${!mode.enabled ? 'cursor-not-allowed opacity-60 hover:bg-black/20' : ''}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{mode.title}</p>
              <p className={`mt-1 text-xs ${value === mode.id ? 'text-slate-700' : 'text-slate-400'}`}>{mode.subtitle}</p>
            </div>
            {!mode.enabled ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-300">
                Coming Soon
              </span>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  )
}

