export default function QuestionCard({ question, displayedText }) {
  if (!question) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
        No active question found. Rebuilding a safe session…
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-slate-300">{question.round}</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-slate-300">{question.domain}</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-slate-300">{question.difficulty}</span>
        {question.isFollowUp ? (
          <span className="rounded-full border border-amber-200/20 bg-amber-500/10 px-2 py-1 text-amber-200">
            Follow-up
          </span>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-100">{displayedText || question.question}</p>
    </div>
  )
}

