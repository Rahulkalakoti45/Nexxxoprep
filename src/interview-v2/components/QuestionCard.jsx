export default function QuestionCard({ question, displayedText }) {
  if (!question) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No active question found. Safe fallback session is loading.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-1">{question.round}</span>
        <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{question.domain}</span>
        <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-700">{question.difficulty}</span>
      </div>
      <p className="text-base leading-relaxed text-slate-900">{displayedText || question.question}</p>
    </div>
  )
}
