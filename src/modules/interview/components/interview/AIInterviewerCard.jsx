export default function AIInterviewerCard({ company, role, isThinking, message }) {
  return (
    <div className="rounded-2xl border border-line bg-inset p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">AI Interviewer</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            {company} • {role}
          </h2>
        </div>
        <div className="h-10 w-10 rounded-full bg-brand-500/20" />
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {message || (isThinking ? 'Thinking… reviewing your response.' : 'Answer clearly with tradeoffs and impact.')}
      </p>
      {isThinking ? (
        <div className="mt-3 flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-200/80" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-200/80 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-200/80 [animation-delay:240ms]" />
        </div>
      ) : null}
    </div>
  )
}

