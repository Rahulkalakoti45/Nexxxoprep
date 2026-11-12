import { ScoreRing } from '../../../../components/ui/index.jsx'
import RoundTracker from './RoundTracker'

function computeStats(session) {
  const entries = Object.values(session.answers || {})
  return {
    answered: entries.filter((e) => e.status === 'answered').length,
    unsure: entries.filter((e) => e.status === 'doubtful').length,
    skipped: entries.filter((e) => e.status === 'skipped').length,
  }
}

/**
 * One or two concrete nudges from the quick on-device check of the last answer. It only looks at
 * length, structure words and topic keywords, so it gives tips rather than a score: the real
 * evaluation is in the report.
 */
function quickTips(evaluation) {
  if (!evaluation) return []
  const tips = []
  if ((evaluation.meta?.wordCount ?? 0) < 60) tips.push('Go one level deeper: add a concrete detail or example.')
  if (evaluation.clarity !== 'clear') tips.push('Give it a shape: the situation, what you did, and the result.')
  if ((evaluation.meta?.matches ?? 0) < 2) tips.push('Name the key concepts and trade-offs for this topic out loud.')
  return tips.length ? tips.slice(0, 2) : ['Good depth and structure. Keep answering like that.']
}

/** Where the candidate is in the interview, plus a quick tip from the last answer. */
export default function InterviewSidebar({ session, currentRoundIndex, lastEvaluation }) {
  const stats = computeStats(session)
  const percent = session.progress?.percent || 0
  const tips = quickTips(lastEvaluation)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-4">
          <ScoreRing score={percent} size={64} stroke={6} tone="brand" />
          <div>
            <p className="text-sm font-semibold text-ink">
              {session.progress?.answered || 0} of {session.progress?.total || 0} done
            </p>
            <p className="text-xs text-ink-muted">
              {stats.unsure ? `${stats.unsure} unsure · ` : ''}
              {stats.skipped ? `${stats.skipped} skipped` : 'Keep going'}
            </p>
          </div>
        </div>
        <div className="mt-5 border-t border-line pt-5">
          <RoundTracker rounds={session.rounds} currentRoundIndex={currentRoundIndex} answers={session.answers} />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <p className="text-sm font-semibold text-ink">Quick tip</p>
        {tips.length ? (
          <ul className="mt-3 space-y-2.5">
            {tips.map((tip) => (
              <li key={tip} className="flex gap-2.5 text-sm text-ink-soft">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" aria-hidden="true" />
                {tip}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">After each answer you&apos;ll get a quick nudge here. Full feedback is in your report.</p>
        )}
      </div>
    </div>
  )
}
