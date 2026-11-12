export default function QuestionCard({ question, company, role, displayedQuestion, interviewerMessage, isThinking }) {
  return (
    <div className="mt-5 rounded-xl border border-line bg-inset p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 text-lg">AI</div>
        <div>
          <p className="text-sm font-medium text-ink">NexoPrep Interviewer</p>
          <p className="text-xs text-ink-muted">{company} style - {role} role</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">{interviewerMessage || 'Please answer clearly and concisely.'}</p>
      <h2 className="mt-4 min-h-[60px] text-xl font-semibold transition-opacity duration-300">{displayedQuestion || question?.question}</h2>
      <div className="mt-2 flex items-center justify-between text-sm text-ink-muted">
        <p>Type: {question?.type} - Domain: {question?.domain}</p>
        {isThinking ? <p className="animate-pulse text-ink-soft">Interviewer is thinking...</p> : null}
      </div>
    </div>
  )
}
