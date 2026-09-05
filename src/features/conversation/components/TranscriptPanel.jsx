export default function TranscriptPanel({ entries = [], partialText = '', currentSpeaker = 'idle' }) {
  return (
    <div className="flex h-80 flex-col rounded-2xl border border-white/10 bg-black/20">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <p className="text-sm font-semibold text-slate-100">Live Transcript</p>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
          {currentSpeaker}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {entries.length === 0 && !partialText ? (
          <p className="text-slate-400">Conversation transcript will appear here in realtime.</p>
        ) : null}
        {entries.map((entry, index) => (
          <div key={`${entry.at}-${index}`} className="rounded-lg border border-white/10 bg-[#0a0f17] p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{entry.speaker}</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-200">{entry.content}</p>
          </div>
        ))}
        {partialText ? (
          <div className="rounded-lg border border-dashed border-white/15 bg-[#0a0f17]/70 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">partial</p>
            <p className="mt-1 text-slate-300">{partialText}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
