import { useCallback, useEffect, useRef, useState } from 'react'
import { BehaviorAnalyzer } from './analysis.js'
import { postBehaviorSummary } from '../../services/backend/sessionsApi.js'

const ANALYSIS_FPS = 10
const FRAME_INTERVAL_MS = 1000 / ANALYSIS_FPS
const HANDS_EVERY_N_FRAMES = 3 // gestures change slowly and hands are usually out of frame
const LIVE_UPDATE_MS = 700
const SUMMARY_POST_INTERVAL_MS = 15_000
const MIN_SAMPLES_TO_POST = 5 // ~5s of data; shorter than that says nothing useful
const FINAL_POST_TIMEOUT_MS = 5_000
const MAX_CONSECUTIVE_FAILURES = 5

// One finalizer per interview session. The interview page calls finalizeBehavior() when the
// candidate ends the interview so the last summary is saved before navigating to the report.
const finalizers = new Map()

/** Saves the final behavior summary for a session. Never rejects and never waits long. */
export function finalizeBehavior(sessionId) {
  const finalize = finalizers.get(sessionId)
  return finalize ? finalize() : Promise.resolve()
}

export function describeCameraError(error) {
  const name = error?.name
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return {
      code: 'permission_denied',
      message: 'Camera access is blocked. Allow the camera for this site in your browser, then try again.',
    }
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return { code: 'no_camera', message: 'No camera was found on this device.' }
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return { code: 'camera_busy', message: 'The camera is in use by another app. Close it and try again.' }
  }
  return { code: 'camera_failed', message: 'The camera could not be started.' }
}

const fmtScore = (value) => `${Number(value).toFixed(1)}/10`

/** Same six values, in the same formats, that the Python engine publishes at /metrics.json. */
function toLive(current) {
  const { scores } = current
  return {
    faceVisible: current.faceVisible,
    calibration: current.calibration,
    tiles: {
      eyeContact: current.faceVisible ? fmtScore(scores.eye) : null,
      posture: current.posture === 'Calibrating' ? 'Calibrating…' : current.posture,
      gesture: current.gesture,
      headStability: current.movement === 'Calibrating' ? '…' : current.movement,
      confidence: fmtScore(scores.engagement),
      behaviorScore: fmtScore(scores.overall),
    },
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs on-device behavior analysis (MediaPipe face / pose / hands) on the candidate's webcam.
 *
 * The video never leaves the browser: only the aggregated scores are sent to the backend, which
 * stores them on the session so the report can show them. Render the returned `videoRef` and
 * `canvasRef` elements (mirrored together) wherever the preview should appear.
 */
export function useBehaviorAnalysis({ sessionId, enabled = true }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const analyzerRef = useRef(null)
  const clockRef = useRef({ start: 0, offset: 0, pausedAt: null })
  const finalizingRef = useRef(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({
    phase: enabled && sessionId ? 'requesting' : 'idle',
    progress: 0,
    error: null,
    live: null,
  })

  const retry = useCallback(() => {
    setState({ phase: 'requesting', progress: 0, error: null, live: null })
    setAttempt((n) => n + 1)
  }, [])

  // ── main capture + analysis loop ──────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) return undefined

    let cancelled = false
    let stream = null
    let timer = null
    let summaryTimer = null
    const clock = clockRef.current
    const patch = (next) => {
      if (!cancelled) setState((prev) => ({ ...prev, ...next }))
    }

    const now = performance.now()
    if (!clock.start) clock.start = now
    if (clock.pausedAt !== null) {
      clock.offset += now - clock.pausedAt
      clock.pausedAt = null
    }
    let hiddenSince = document.hidden ? now : null
    const onVisibility = () => {
      if (document.hidden) hiddenSince = performance.now()
      else if (hiddenSince !== null) {
        // Time spent in another tab isn't "looking away", so keep it off the analysis clock.
        clock.offset += performance.now() - hiddenSince
        hiddenSince = null
        videoRef.current?.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const stopCapture = () => {
      clearTimeout(timer)
      clearInterval(summaryTimer)
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      const video = videoRef.current
      if (video) video.srcObject = null
      if (clock.pausedAt === null) clock.pausedAt = performance.now()
    }

    const fail = (error) => {
      stopCapture()
      patch({ phase: 'error', error, live: null })
    }

    const postPartial = () => {
      const summary = analyzerRef.current?.summary()
      if (!summary || summary.samples < MIN_SAMPLES_TO_POST || finalizingRef.current) return
      postBehaviorSummary(sessionId, summary, { final: false }).catch(() => {
        // Best effort: the next interval (or the final summary) carries the same data.
      })
    }

    const run = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        fail({ code: 'insecure_context', message: 'Camera access needs a secure (HTTPS) connection.' })
        return
      }

      let media
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        })
      } catch (error) {
        if (!cancelled) fail(describeCameraError(error))
        return
      }
      if (cancelled) {
        media.getTracks().forEach((track) => track.stop())
        return
      }
      stream = media

      const video = videoRef.current
      if (!video) {
        stopCapture()
        return
      }
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      try {
        await video.play()
      } catch {
        // Autoplay can be refused in odd embeds; frames still arrive once the element plays.
      }
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (!cancelled) fail({ code: 'camera_lost', message: 'The camera was disconnected.' })
      })

      patch({ phase: 'loading', progress: 0 })
      let landmarkers
      let drawOverlay
      try {
        // Dynamic import keeps MediaPipe (and its ~30 MB of assets) out of the main bundle.
        const loader = await import('./landmarkers.js')
        drawOverlay = loader.drawOverlay
        landmarkers = await loader.loadLandmarkers({ onProgress: (progress) => patch({ progress }) })
      } catch (error) {
        console.error('[behavior] could not load vision models', error)
        if (!cancelled) {
          fail({
            code: 'model_failed',
            message: 'The on-device vision models could not be downloaded. Check your connection and try again.',
          })
        }
        return
      }
      if (cancelled) return

      if (!analyzerRef.current) analyzerRef.current = new BehaviorAnalyzer({ fps: ANALYSIS_FPS })
      const analyzer = analyzerRef.current
      patch({ phase: 'running' })

      let lastVideoTime = -1
      let lastTimestamp = 0
      let frame = 0
      let lastHands = []
      let failures = 0
      let lastLiveAt = 0

      const tick = async () => {
        if (cancelled) return
        const frameStart = performance.now()
        try {
          const ready = !document.hidden && video.readyState >= 2 && video.videoWidth > 0
          // A frozen camera stops advancing currentTime, so skip it; some browsers leave live
          // streams at 0, in which case every tick is treated as a new frame.
          if (ready && (video.currentTime !== lastVideoTime || video.currentTime === 0)) {
            lastVideoTime = video.currentTime
            const timestamp = Math.max(Math.round(frameStart), lastTimestamp + 1)
            lastTimestamp = timestamp

            const result = landmarkers.detect(video, timestamp, { withHands: frame % HANDS_EVERY_N_FRAMES === 0 })
            if (result.hands) lastHands = result.hands
            frame += 1
            failures = 0

            const seconds = (frameStart - clock.start - clock.offset) / 1000
            const current = analyzer.process({
              t: seconds,
              w: video.videoWidth,
              h: video.videoHeight,
              face: result.face,
              blendshapes: result.blendshapes,
              pose: result.pose,
              hands: lastHands,
            })

            const canvas = canvasRef.current
            if (canvas) {
              if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
              if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
              drawOverlay(canvas, landmarkers.vision, { face: result.face, pose: result.pose, hands: lastHands })
            }
            if (frameStart - lastLiveAt >= LIVE_UPDATE_MS) {
              lastLiveAt = frameStart
              patch({ live: toLive(current) })
            }
          }
        } catch (error) {
          failures += 1
          if (failures >= MAX_CONSECUTIVE_FAILURES) {
            failures = 0
            console.warn('[behavior] analysis keeps failing', error)
            if (landmarkers.delegate === 'GPU') {
              try {
                await landmarkers.useCpu()
              } catch {
                fail({ code: 'analysis_failed', message: 'Behavior analysis stopped unexpectedly.' })
                return
              }
            } else {
              fail({ code: 'analysis_failed', message: 'Behavior analysis stopped unexpectedly.' })
              return
            }
          }
        }
        if (!cancelled) timer = setTimeout(tick, Math.max(FRAME_INTERVAL_MS - (performance.now() - frameStart), 4))
      }

      summaryTimer = setInterval(postPartial, SUMMARY_POST_INTERVAL_MS)
      tick()
    }

    run()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      stopCapture()
    }
  }, [enabled, sessionId, attempt])

  // ── saving the summary ────────────────────────────────────────────
  const finalize = useCallback(() => {
    if (!finalizingRef.current) {
      finalizingRef.current = (async () => {
        const summary = analyzerRef.current?.summary()
        if (!summary || summary.samples < MIN_SAMPLES_TO_POST) return
        await Promise.race([
          postBehaviorSummary(sessionId, summary, { final: true }).catch((error) => {
            console.warn('[behavior] could not save the final summary', error)
          }),
          delay(FINAL_POST_TIMEOUT_MS),
        ])
      })()
    }
    return finalizingRef.current
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return undefined
    finalizers.set(sessionId, finalize)
    return () => {
      if (finalizers.get(sessionId) === finalize) finalizers.delete(sessionId)
    }
  }, [sessionId, finalize])

  // Leaving the interview page any other way (back button, tab close) still keeps what was measured.
  useEffect(() => {
    const analyzer = analyzerRef
    const finalizing = finalizingRef
    return () => {
      const summary = analyzer.current?.summary()
      if (!sessionId || !summary || summary.samples < MIN_SAMPLES_TO_POST || finalizing.current) return
      finalizing.current = postBehaviorSummary(sessionId, summary, { final: true, keepalive: true }).catch(() => {})
    }
  }, [sessionId])

  return { videoRef, canvasRef, retry, ...state }
}
