export default function AIInterviewerCard({ company, isThinking }) {
  return (
    <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-indigo-700">AI Interviewer</p>
          <h2 className="text-lg font-semibold text-slate-900">{String(company || 'NexoPrep').toUpperCase()} Panel</h2>
        </div>
        <div className="h-12 w-12 rounded-full bg-indigo-200" />
      </div>
      <p className="mt-3 text-sm text-slate-700">
        {isThinking ? 'Analyzing your previous response...' : 'Please provide a structured and concise answer.'}
      </p>
      {isThinking ? (
        <div className="mt-2 flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:240ms]" />
        </div>
      ) : null}
    </div>
  )
}
