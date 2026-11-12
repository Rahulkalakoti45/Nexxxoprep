import { useEffect, useState } from 'react'
import { getUserProgress } from '../../services/backend/reportsApi.js'
import { Badge, Card, CardHeader } from '../../components/ui/index.jsx'

const TREND = {
  still_weak: { label: 'Still weak', tone: 'bad' },
  new: { label: 'New', tone: 'warn' },
  improving: { label: 'Improving', tone: 'info' },
  resolved: { label: 'Fixed', tone: 'good' },
}

const DOT = { bad: 'bg-rose-400', warn: 'bg-amber-400', info: 'bg-sky-400', good: 'bg-emerald-400' }

/** Score history as small dots, so the direction is visible at a glance. */
function ScoreTrail({ scores, tone }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Scores, oldest first: ${scores.map((s) => s.score).join(', ')}`}>
      {scores.map((s, i) => (
        <span key={`${s.sessionId}-${i}`} className="flex items-center gap-1.5">
          {i > 0 ? <span className="h-px w-3 bg-line-strong" aria-hidden="true" /> : null}
          <span className="flex items-center gap-1 font-mono text-xs text-ink-soft">
            <span className={`h-1.5 w-1.5 rounded-full ${i === scores.length - 1 ? DOT[tone] : 'bg-ink-faint'}`} aria-hidden="true" />
            {s.score}
          </span>
        </span>
      ))}
    </div>
  )
}

/** Weak spots across all sessions, how each is trending, and what the next interview will revisit. */
export default function WeakSpotProgressPanel({ userId, refreshKey }) {
  // Only set from the request's callbacks; a failed request hides the panel until the next one succeeds.
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getUserProgress(userId)
      .then((data) => {
        if (!cancelled) setProgress(data)
      })
      .catch(() => {
        if (!cancelled) setProgress(null)
      })
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  if (!userId || !progress || !progress.sessionCount) return null

  return (
    <Card>
      <CardHeader
        title="Weak spots over time"
        subtitle="Any topic that scored below 6/10, and where it stands now."
        action={<span className="text-xs text-ink-faint">{progress.sessionCount} interviews</span>}
      />

      {progress.weakSpots.length ? (
        <ul className="mt-5 grid gap-2.5 md:grid-cols-2">
          {progress.weakSpots.map((spot) => {
            const trend = TREND[spot.trend] || TREND.still_weak
            return (
              <li key={spot.topic} className="flex items-center gap-3 rounded-xl border border-line bg-inset/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{spot.topic}</p>
                  <div className="mt-1">
                    <ScoreTrail scores={spot.scores} tone={trend.tone} />
                  </div>
                </div>
                <Badge tone={trend.tone}>{trend.label}</Badge>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">No weak spots. Every topic you&apos;ve been scored on is at 6/10 or above.</p>
      )}
    </Card>
  )
}
