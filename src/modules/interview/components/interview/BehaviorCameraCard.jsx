import { useEffect, useRef, useState } from 'react'
import { getApiBaseUrl, getApiKey } from '../../../../lib/api.js'

const STREAM_RETRY_DELAY_MS = 1500
const STREAM_MAX_RETRIES = 40 // ~60s — generous enough to cover MediaPipe
// model load + camera open on a cold start, since the stream socket isn't
// bound until that finishes (see BehaviorEngineService.getStreamTarget).
const METRICS_POLL_INTERVAL_MS = 1200

/**
 * BehaviorCameraCard
 *
 * Renders the live behavior-analysis preview beneath the AI Interviewer
 * card. Thin, reusable shell: it knows nothing about posture/gaze/scoring
 * internals — it points an <img> at the backend's MJPEG proxy (see
 * apps/server/src/routes/sessions.routes.ts, GET /:sessionId/behavior/stream)
 * and polls a small metrics endpoint for the live values shown below it.
 */
export default function BehaviorCameraCard({ sessionId }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      {/* Keyed by sessionId so a new interview always gets a fresh mount
          (fresh retry state, fresh metrics poll) instead of carrying over
          state from a previous session. */}
      <BehaviorStream key={sessionId ?? 'no-session'} sessionId={sessionId} />
      <BehaviorMetrics key={sessionId ?? 'no-session'} sessionId={sessionId} />
    </div>
  )
}

function BehaviorStream({ sessionId }) {
  const [retryCount, setRetryCount] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const retryTimer = useRef(null)

  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
    }
  }, [])

  const baseStreamUrl = sessionId
    ? `${getApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/behavior/stream?apiKey=${encodeURIComponent(getApiKey())}`
    : null
  // Cache-bust each retry attempt so the browser issues a fresh request
  // instead of reusing a failed one.
  const streamUrl = baseStreamUrl && retryCount > 0 ? `${baseStreamUrl}&attempt=${retryCount}` : baseStreamUrl
  const active = Boolean(streamUrl) && !gaveUp

  const handleError = () => {
    if (retryCount >= STREAM_MAX_RETRIES) {
      setGaveUp(true)
      return
    }
    // A 404/refused connection here is expected while the engine is
    // still loading MediaPipe models and opening the camera — not a
    // terminal failure, so retry with backoff-ish fixed delay instead
    // of giving up on the first attempt.
    retryTimer.current = setTimeout(() => {
      setRetryCount((n) => n + 1)
    }, STREAM_RETRY_DELAY_MS)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Behavior Camera</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">Live Preview</h2>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-500'}`}
          title={active ? 'Tracking active' : 'Tracking unavailable'}
        />
      </div>

      <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/40">
        {active ? (
          <img
            src={streamUrl}
            alt="Live behavior analysis preview"
            className="h-full w-full object-cover"
            onError={handleError}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-slate-500">
            {sessionId
              ? gaveUp
                ? 'Behavior tracking unavailable for this session.'
                : 'Starting behavior tracking\u2026'
              : 'Behavior tracking will appear once the interview starts.'}
          </div>
        )}
      </div>
    </>
  )
}

const METRIC_FIELDS = [
  { key: 'eyeContact', label: 'Eye Contact' },
  { key: 'posture', label: 'Posture' },
  { key: 'gesture', label: 'Gesture' },
  { key: 'headStability', label: 'Head Stability' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'behaviorScore', label: 'Behavior Score' },
]

function BehaviorMetrics({ sessionId }) {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    if (!sessionId) return undefined
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/behavior/metrics?apiKey=${encodeURIComponent(getApiKey())}`,
        )
        if (!res.ok) return // not ready yet — normal during startup, just keep showing dashes
        const data = await res.json()
        if (!cancelled) setMetrics(data)
      } catch {
        // Network hiccup or engine not up yet — leave last-known values in
        // place rather than flashing back to dashes.
      }
    }

    poll()
    const interval = setInterval(poll, METRICS_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sessionId])

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {METRIC_FIELDS.map(({ key, label }) => (
        <div key={key} className="rounded-lg border border-white/5 bg-white/5 px-2 py-1.5 text-center">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-0.5 text-sm font-medium text-slate-300">
            {metrics && metrics[key] != null ? metrics[key] : '\u2014'}
          </p>
        </div>
      ))}
    </div>
  )
}
