import { Badge, Card, CardHeader, ScoreBar } from '../../components/ui/index.jsx'

const SIGNAL_LABELS = {
  posture: 'Posture',
  movement: 'Head stability',
  eyeContact: 'Eye contact',
  expression: 'Expression',
  gesture: 'Gestures',
}

const TREND_TONES = {
  improving: 'good',
  declining: 'warn',
  stable: 'neutral',
  'insufficient data': 'neutral',
}

const SEVERITY_TONES = { high: 'bad', medium: 'warn', low: 'neutral' }

const formatScore = (value) => (value == null ? '–' : value.toFixed(1))

function formatClock(seconds) {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-line bg-inset/60 p-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-ink">
        {value}
        <span className="ml-1 text-sm font-normal text-ink-faint">/ 10</span>
      </p>
    </div>
  )
}

/**
 * Camera coaching block of the interview report: private feedback on posture, eye contact and
 * engagement. `behavior` comes from mapBehaviorReport() and is null when the camera was off.
 */
export default function BehaviorReportSection({ behavior }) {
  if (!behavior) {
    return (
      <Card>
        <CardHeader title="Camera coaching" subtitle="Turn on the camera coach during your next interview to get tips on posture, eye contact and engagement. Only you see them." />
      </Card>
    )
  }

  const { scores, percentages, trends, events } = behavior
  const signals = scores
    ? ['posture', 'movement', 'eyeContact', 'expression', ...(behavior.gestureObserved ? ['gesture'] : [])].map((key) => ({
        key,
        label: SIGNAL_LABELS[key],
        score: scores[key] ?? null,
      }))
    : []
  const detailRows = percentages
    ? [
        ['Looking at the camera', percentages.atCameraGazePct],
        ['Upright posture', percentages.uprightPosturePct],
        ['Steady head and shoulders', percentages.stableMovementPct],
        ['Smiling', percentages.smilingPct],
        ['Face in frame', percentages.faceVisiblePct],
      ].filter(([, value]) => typeof value === 'number')
    : []
  const trendRows = trends
    ? [
        ['Posture', trends.posture],
        ['Eye contact', trends.eyeContact],
        ['Overall', trends.overall],
      ].filter(([, value]) => value)
    : []

  return (
    <Card>
      <CardHeader
        title="Camera coaching"
        subtitle={`${behavior.source === 'browser' ? 'Measured on your device from your webcam' : 'Measured by the behavior engine'}${
          behavior.durationSeconds ? ` · ${formatClock(behavior.durationSeconds)} analysed` : ''
        }. Only you see this.`}
        action={
          behavior.strongestSignal && behavior.weakestSignal ? (
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="good">Best: {SIGNAL_LABELS[behavior.strongestSignal] ?? behavior.strongestSignal}</Badge>
              <Badge tone="warn">Work on: {SIGNAL_LABELS[behavior.weakestSignal] ?? behavior.weakestSignal}</Badge>
            </div>
          ) : null
        }
      />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Presence" value={formatScore(behavior.overall)} />
        <Stat label="Engagement" value={formatScore(behavior.engagement)} />
        <Stat label="Attention" value={formatScore(behavior.attention)} />
      </div>

      {signals.length || detailRows.length ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {signals.length ? (
            <div className="space-y-4 rounded-xl border border-line bg-inset/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">By signal</p>
              {signals.map((s) => (
                <ScoreBar key={s.key} label={s.label} score={s.score === null ? null : s.score * 10} />
              ))}
            </div>
          ) : null}

          <div className="space-y-4">
            {detailRows.length ? (
              <div className="space-y-4 rounded-xl border border-line bg-inset/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Share of the interview</p>
                {detailRows.map(([label, value]) => (
                  <ScoreBar key={label} label={label} score={Math.min(Math.max(value, 0), 100)} />
                ))}
              </div>
            ) : null}

            {trendRows.length ? (
              <div className="rounded-xl border border-line bg-inset/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Through the interview</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {trendRows.map(([label, value]) => (
                    <li key={label} className="flex items-center justify-between">
                      <span className="text-ink-soft">{label}</span>
                      <Badge tone={TREND_TONES[value] ?? 'neutral'}>{value}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {events.length ? (
        <div className="mt-5 rounded-xl border border-line bg-inset/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Moments worth a look</p>
          <ul className="mt-3 space-y-2.5 text-sm">
            {events.slice(0, 8).map((event, index) => (
              <li key={`${event.time}-${event.type}-${index}`} className="flex items-start gap-3">
                <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-ink-faint">{formatClock(event.time)}</span>
                <Badge tone={SEVERITY_TONES[event.severity] ?? 'neutral'} className="shrink-0">
                  {event.type}
                </Badge>
                <span className="text-ink-soft">{event.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {behavior.partial ? (
        <p className="mt-4 text-xs text-amber-200/80">The final save didn&apos;t complete, so these numbers only cover the part of the interview captured before it.</p>
      ) : null}
      <p className="mt-4 text-xs text-ink-faint">
        {behavior.source === 'browser' ? 'Estimated from face, pose and hand landmarks on your device; your video is never uploaded. ' : ''}
        Indicative only: lighting, camera angle and framing change the numbers.
      </p>
    </Card>
  )
}
