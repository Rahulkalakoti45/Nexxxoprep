import ConfidenceMeter from './ConfidenceMeter'
import DomainTracker from './DomainTracker'
import ProgressTracker from './ProgressTracker'
import RoundTracker from './RoundTracker'

function PlaceholderCard({ title, subtitle }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111620] p-4">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-2 text-xs text-slate-400">{subtitle}</p>
      <div className="mt-3 h-20 rounded-xl border border-dashed border-white/10 bg-black/20" />
    </div>
  )
}

function computeStats(session) {
  const entries = Object.values(session.answers || {})
  const answered = entries.filter((e) => e.status === 'answered').length
  const skipped = entries.filter((e) => e.status === 'skipped').length
  const doubtful = entries.filter((e) => e.status === 'doubtful').length
  const avgLen = entries.length
    ? Math.round(entries.reduce((s, e) => s + (e.answer ? e.answer.split(/\\s+/).filter(Boolean).length : 0), 0) / entries.length)
    : 0
  const avgTime = entries.length ? Math.round(entries.reduce((s, e) => s + (e.timeTakenSeconds || 0), 0) / entries.length) : 0

  const byDomain = {}
  for (const q of session.questions || []) {
    if (!q) continue
    const domain = q.domain || 'general'
    if (!byDomain[domain]) byDomain[domain] = { total: 0, answered: 0 }
    byDomain[domain].total += 1
    if (session.answers?.[q.id]) byDomain[domain].answered += 1
  }
  const dominant = Object.entries(byDomain)
    .sort((a, b) => b[1].answered - a[1].answered)
    .map(([d]) => d)[0]

  const completion = session.progress?.percent || 0
  const confidenceEstimate = entries.length
    ? Math.round(entries.reduce((s, e) => s + (e.score || 0), 0) / entries.length)
    : 0

  return { answered, skipped, doubtful, avgLen, avgTime, dominant: dominant || '--', completion, confidenceEstimate }
}

function StatsCard({ session }) {
  const stats = computeStats(session)
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111620] p-4">
      <p className="text-sm font-semibold text-slate-100">Session Stats</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-200">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">Answered: {stats.answered}</div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">Skipped: {stats.skipped}</div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">Doubtful: {stats.doubtful}</div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">Avg length: {stats.avgLen}w</div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">Avg time: {stats.avgTime}s</div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">Dominant: {stats.dominant}</div>
      </div>
      <p className="mt-2 text-xs text-slate-400">Completion: {stats.completion}% • Confidence: ~{stats.confidenceEstimate}%</p>
    </div>
  )
}

export default function InterviewSidebar({ session, currentRoundIndex, currentQuestion, lastScore, onSelectRound }) {
  return (
    <div className="space-y-3">
      <RoundTracker rounds={session.rounds} currentRoundIndex={currentRoundIndex} answers={session.answers} onSelectRound={onSelectRound} />
      <ProgressTracker progress={session.progress} />
      <DomainTracker domain={currentQuestion?.domain} />
      <ConfidenceMeter lastScore={lastScore} />
      <PlaceholderCard title="Behavior Analysis" subtitle="Webcam + micro-expressions (placeholder)." />
      <StatsCard session={session} />
    </div>
  )
}

