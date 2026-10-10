import { useEffect, useRef, useState } from 'react'
import { getApiBaseUrl, getApiKey } from '../../../../lib/api.js'
import { getBehaviorStatus } from '../../../../services/backend/sessionsApi.js'
import { useBehaviorAnalysis } from '../../../../features/behavior/useBehaviorAnalysis.js'

const STREAM_RETRY_DELAY_MS = 1500
const STREAM_MAX_RETRIES = 40 // ~60s — generous enough to cover MediaPipe
// model load + camera open on a cold start, since the stream socket isn't
// bound until that finishes (see BehaviorEngineService.getStreamTarget).
const METRICS_POLL_INTERVAL_MS = 1200
const STATUS_RETRY_DELAY_MS = 800
const STATUS_INITIAL_TRIES = 3
const STATUS_POLL_INTERVAL_MS = 3000

/**
 * BehaviorCameraCard
 *
 * Renders the live behavior-analysis preview beneath the AI Interviewer card.
 *
 * There are two ways the analysis can run, and the card picks one per session:
 *  - "server": the Python Behavior Engine runs next to the backend with its own
 *    webcam (local development). The card points an <img> at the backend's MJPEG
 *    proxy and polls a small metrics endpoint.
 *  - "browser": anywhere the backend has no camera (any hosted deployment). The
 *    candidate's browser asks for camera permission and runs the same analysis
 *    on-device with MediaPipe; only the resulting scores are sent to the backend.
 */
export default function BehaviorCameraCard({ sessionId }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      {/* Keyed by sessionId so a new interview always gets a fresh mount
          (fresh retry state, fresh camera) instead of carrying over state
          from a previous session. */}
      <BehaviorCardBody key={sessionId ?? 'no-session'} sessionId={sessionId} />
    </div>
  )
}

/**
 * Decides between the server-side engine and in-browser analysis. The backend
 * reports 'unavailable' when the engine is disabled or was never started for
 * this session, which is what every hosted deployment sees.
 */
function useBehaviorMode(sessionId) {
  const [mode, setMode] = useState('detecting')

  useEffect(() => {
    if (!sessionId) return undefined
    let cancelled = false
    let timer = null
    let tries = 0
    let misses = 0
    let decided = false

    const isLive = (status) => status === 'starting' || status === 'running'
    // 'stopping'/'stopped' is a normal end of the interview, not a reason to open the camera.
    const hasFailed = (status) => status === 'crashed' || status === 'unavailable'

    // undefined = the request itself failed (status unknown); null = the backend has no engine for it.
    const readStatus = async () => {
      try {
        return (await getBehaviorStatus(sessionId, { retries: 0 }))?.status ?? null
      } catch {
        return undefined
      }
    }

    const check = async () => {
      const status = await readStatus()
      if (cancelled) return

      if (!decided) {
        if (status === undefined && (tries += 1) < STATUS_INITIAL_TRIES) {
          timer = setTimeout(check, STATUS_RETRY_DELAY_MS)
          return
        }
        decided = true
        if (isLive(status)) {
          setMode('server')
          timer = setTimeout(check, STATUS_POLL_INTERVAL_MS)
        } else {
          setMode('browser')
        }
        return
      }

      // Already in server mode: switch over only if the engine really died.
      misses = hasFailed(status) ? misses + 1 : 0
      if (misses >= 2) {
        setMode('browser')
        return
      }
      timer = setTimeout(check, STATUS_POLL_INTERVAL_MS)
    }

    check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId])

  return [mode, setMode]
}

function BehaviorCardBody({ sessionId }) {
  const [mode, setMode] = useBehaviorMode(sessionId)

  if (!sessionId || mode === 'detecting') {
    return (
      <>
        <CardHeader state="idle" />
        <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-slate-500">
            {sessionId ? 'Starting behavior tracking…' : 'Behavior tracking will appear once the interview starts.'}
          </div>
        </div>
        <MetricTiles />
      </>
    )
  }

  if (mode === 'server') {
    return (
      <>
        <BehaviorStream sessionId={sessionId} onGiveUp={() => setMode('browser')} />
        <BehaviorMetrics sessionId={sessionId} />
      </>
    )
  }

  return <BrowserBehavior sessionId={sessionId} />
}

function CardHeader({ state }) {
  const dot = {
    active: ['bg-emerald-400', 'Tracking active'],
    busy: ['bg-amber-400 animate-pulse', 'Starting'],
    error: ['bg-red-400', 'Tracking unavailable'],
    idle: ['bg-slate-500', 'Tracking unavailable'],
  }[state]
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Behavior Camera</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-100">Live Preview</h2>
      </div>
      <span className={`h-2.5 w-2.5 rounded-full ${dot[0]}`} title={dot[1]} />
    </div>
  )
}

// ── server mode: Python engine, MJPEG stream + polled metrics ─────────

function BehaviorStream({ sessionId, onGiveUp }) {
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
      // The engine never produced a stream: use this device's camera instead.
      onGiveUp?.()
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
      <CardHeader state={active ? 'active' : 'idle'} />

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
                : 'Starting behavior tracking…'
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

function MetricTiles({ values }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {METRIC_FIELDS.map(({ key, label }) => (
        <div key={key} className="rounded-lg border border-white/5 bg-white/5 px-2 py-1.5 text-center">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-0.5 text-sm font-medium text-slate-300">
            {values && values[key] != null ? values[key] : '—'}
          </p>
        </div>
      ))}
    </div>
  )
}

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

  return <MetricTiles values={metrics} />
}

// ── browser mode: on-device MediaPipe analysis ────────────────────────

function BrowserBehavior({ sessionId }) {
  const { videoRef, canvasRef, phase, progress, error, live, retry } = useBehaviorAnalysis({ sessionId })
  const running = phase === 'running'
  const headerState = running ? 'active' : phase === 'error' ? 'error' : 'busy'

  return (
    <>
      <CardHeader state={headerState} />

      <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
        {/* Mirrored like a mirror so the preview moves the way the candidate does. */}
        <div className="absolute inset-0" style={{ transform: 'scaleX(-1)' }}>
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
            aria-label="Your camera preview"
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        </div>

        {phase === 'requesting' ? (
          <Overlay>
            <p className="font-medium text-slate-100">Allow camera access</p>
            <p className="mt-1">Choose &ldquo;Allow&rdquo; in your browser&rsquo;s prompt to start behavior analysis.</p>
          </Overlay>
        ) : null}

        {phase === 'loading' ? (
          <Overlay>
            <p className="font-medium text-slate-100">Loading on-device vision models&hellip;</p>
            <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-slate-500">{Math.round(progress * 100)}% &middot; first time only</p>
          </Overlay>
        ) : null}

        {phase === 'error' ? (
          <Overlay>
            <p className="font-medium text-slate-100">Behavior analysis is off</p>
            <p className="mt-1">{error?.message}</p>
            <p className="mt-1 text-slate-500">The interview continues without it.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white"
            >
              Try again
            </button>
          </Overlay>
        ) : null}

        {running && live && !live.faceVisible ? (
          <Chip tone="warn">No face detected &mdash; move into frame</Chip>
        ) : running && live && live.calibration < 1 ? (
          <Chip>Calibrating your posture&hellip; sit naturally</Chip>
        ) : null}
      </div>

      <MetricTiles values={live?.tiles} />
      <p className="mt-3 text-[11px] leading-snug text-slate-500">
        Analysed on your device. Your video is never uploaded &mdash; only the scores are saved to your report.
      </p>
    </>
  )
}

function Overlay({ children }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-5 text-center text-xs text-slate-400"
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  )
}

function Chip({ children, tone = 'info' }) {
  const colors = tone === 'warn' ? 'bg-amber-500/25 text-amber-100' : 'bg-black/60 text-slate-200'
  return (
    <div className={`absolute inset-x-2 bottom-2 rounded-lg px-2.5 py-1 text-center text-[11px] ${colors}`} role="status">
      {children}
    </div>
  )
}
