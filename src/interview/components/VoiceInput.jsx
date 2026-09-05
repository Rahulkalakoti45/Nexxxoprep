export default function VoiceInput({ supported, listening, onToggle, disabled }) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={!supported || disabled}
        className={`rounded-lg border px-3 py-2 text-sm transition ${
          listening
            ? 'animate-pulse border-slate-200 bg-slate-100 text-slate-900 shadow-md shadow-slate-200/20'
            : 'border-white/15 bg-black/20 text-slate-200 hover:bg-white/10'
        } ${!supported ? 'cursor-not-allowed opacity-50 hover:bg-black/20' : ''}`}
      >
        {supported ? (listening ? 'Stop Mic' : 'Mic Input') : 'Mic Unsupported'}
      </button>
      {listening ? <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> : null}
      {!supported ? <span className="text-xs text-slate-400">Browser voice input unavailable</span> : null}
    </div>
  )
}
