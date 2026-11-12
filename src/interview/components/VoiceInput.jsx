export default function VoiceInput({ supported, listening, onToggle, disabled }) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={!supported || disabled}
        className={`rounded-lg border px-3 py-2 text-sm transition ${
          listening
            ? 'animate-pulse border-brand-400/70 bg-brand-500/15 text-ink shadow-glow shadow-md shadow-slate-200/20'
            : 'border-line-strong bg-inset text-ink hover:bg-white/10'
        } ${!supported ? 'cursor-not-allowed opacity-50 hover:bg-inset' : ''}`}
      >
        {supported ? (listening ? 'Stop Mic' : 'Mic Input') : 'Mic Unsupported'}
      </button>
      {listening ? <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> : null}
      {!supported ? <span className="text-xs text-ink-muted">Browser voice input unavailable</span> : null}
    </div>
  )
}
