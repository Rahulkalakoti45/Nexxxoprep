export default function InterviewerAvatar({ speaking = false, thinking = false }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative flex h-32 w-32 items-center justify-center rounded-full border-2 bg-gradient-to-br from-slate-700 to-slate-900 ${
          speaking ? 'border-emerald-300/60 shadow-lg shadow-emerald-500/20' : 'border-white/15'
        } ${thinking ? 'animate-pulse' : ''}`}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#0a0f17] text-3xl font-semibold text-slate-100">
          AI
        </div>
        {speaking && (
          <span className="absolute -bottom-1 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
            Speaking
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-slate-200">NexoPrep Interviewer</p>
      <p className="text-xs text-slate-400">{thinking ? 'Thinking…' : speaking ? 'Responding' : 'Listening'}</p>
    </div>
  )
}
