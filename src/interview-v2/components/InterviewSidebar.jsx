import ProgressTracker from './ProgressTracker'
import RoundTracker from './RoundTracker'

function Badge({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

export default function InterviewSidebar({ state, currentQuestion }) {
  const confidence = state.currentQuestionIndex === 0 ? 'baseline' : 'adapting'
  return (
    <div className="space-y-3">
      <RoundTracker rounds={state.rounds} currentRoundIndex={state.currentRoundIndex} />
      <ProgressTracker progress={state.progress} />
      <Badge label="Domain Tracker" value={currentQuestion?.domain || 'n/a'} />
      <Badge label="Confidence Meter" value={confidence} />
      <Badge label="Behavior Signal" value="placeholder" />
    </div>
  )
}
