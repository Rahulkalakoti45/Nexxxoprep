// Behavior analysis (posture, gaze, expression, gesture, movement, scoring).
// Port of behavior-engine/{detector,scoring,tracker}.py with no DOM or MediaPipe imports,
// so it can be unit-tested in Node. Inputs are MediaPipe Tasks landmarks: arrays of
// {x, y, z, visibility?} in normalized image coordinates, taken from the raw (un-mirrored)
// camera frame. Everything is analysed in the mirrored view the Python engine used.

export const CONFIG = {
  SPINE_STRAIGHT_MAX: 12,
  SPINE_SLIGHT_MAX: 24,
  SPINE_SLOUCH_MAX: 38,
  MOVEMENT_STABLE_MAX: 0.0012,
  MOVEMENT_MODERATE_MAX: 0.004,
  MOVEMENT_RESTLESS_MIN: 0.007,
  EXP_SMOOTH_ALPHA: 0.3,
  BLINK_THRESHOLD: 0.21,
  EYE_CLOSED_RATIO: 0.15,
  SMILE_BLENDSHAPE_MIN: 0.35,
  BROW_TENSION_MIN: 0.5,
  GAZE_H_INNER: 0.32,
  GAZE_H_OUTER: 0.68,
  GAZE_V_INNER: 0.28,
  GAZE_V_OUTER: 0.72,
  GAZE_BREAK_DURATION: 3.5,
  MOVEMENT_SPIKE_VAR: 0.007,
  POSTURE_INSTABILITY_SEC: 5.0,
  EYE_CLOSURE_WARN_SEC: 2.5,
  FACE_GONE_WARN_SEC: 3.0,
  LOG_INTERVAL_SEC: 1.0,
  MAX_LOGS: 7200,
  MAX_EVENTS: 100,
}

const WARNING_COOLDOWN = {
  'Prolonged Gaze Break': 8.0,
  'Repeated Downward Gaze': 10.0,
  'Posture Instability': 8.0,
  'Heavy Slouch': 10.0,
  'High Movement Variance': 6.0,
  'Restless Behavior': 8.0,
  'Eyes Closed': 5.0,
  'Face Not Visible': 5.0,
}

const POSE = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
}
const TRACKED_POSE = [POSE.NOSE, POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER, POSE.LEFT_WRIST, POSE.RIGHT_WRIST]

const FACE = {
  NOSE_TIP: 1,
  CHIN: 152,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  // Corner/lid/iris groups, each internally consistent (same physical eye).
  EYE_A: { outer: 33, inner: 133, top: 159, bottom: 145, iris: [469, 470, 471, 472] },
  EYE_B: { outer: 263, inner: 362, top: 386, bottom: 374, iris: [474, 475, 476, 477] },
}

const FINGERTIPS = [4, 8, 12, 16, 20]
const FINGER_MIDS = [3, 6, 10, 14, 18]

// ── small numeric helpers ──────────────────────────────────────────
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length
const round1 = (x) => Math.round(x * 10) / 10
const round2 = (x) => Math.round(x * 100) / 100
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi)
const angleOfVector = (p1, p2) => (Math.atan2(Math.abs(p2[0] - p1[0]), Math.max(Math.abs(p2[1] - p1[1]), 1e-6)) * 180) / Math.PI

function median(arr) {
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// numpy.percentile with linear interpolation
function percentile(arr, q) {
  const s = [...arr].sort((a, b) => a - b)
  const pos = ((s.length - 1) * q) / 100
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

/** Window sizes in the Python engine are frames at ~30 fps; scale them to the analysis rate. */
export const windowFor = (frames30, fps) => Math.max(3, Math.round((frames30 * fps) / 30))

// ── smoothing buffers ──────────────────────────────────────────────
class StateBuffer {
  constructor(size, fallback) {
    this.size = size
    this.fallback = fallback
    this.buf = []
  }

  update(state) {
    this.buf.push(state)
    if (this.buf.length > this.size) this.buf.shift()
    const counts = new Map()
    for (const s of this.buf) counts.set(s, (counts.get(s) ?? 0) + 1)
    let best = this.fallback
    let bestN = 0
    for (const [s, n] of counts) {
      if (n > bestN) {
        best = s
        bestN = n
      }
    }
    return best
  }
}

class ScoreBuffer {
  constructor(size) {
    this.size = size
    this.buf = []
  }

  update(v) {
    this.buf.push(v)
    if (this.buf.length > this.size) this.buf.shift()
    return round1(mean(this.buf))
  }
}

class GazeBuffer {
  constructor(size) {
    this.size = size
    this.h = []
    this.v = []
  }

  update(h, v) {
    this.h.push(h)
    this.v.push(v)
    if (this.h.length > this.size) {
      this.h.shift()
      this.v.shift()
    }
    return [median(this.h), median(this.v)]
  }
}

export class PostureCalibrator {
  constructor(frames) {
    this.frames = frames
    this.samples = []
    this.offset = 0
    this.calibrated = false
  }

  feed(composite) {
    if (this.calibrated) return
    if (composite > 0) this.samples.push(composite)
    if (this.samples.length >= this.frames) {
      this.offset = Math.max(percentile(this.samples, 25) - 8.0, 0)
      this.calibrated = true
    }
  }

  adjust(composite) {
    return Math.max(composite - this.offset, 0)
  }

  get progress() {
    return Math.min(this.samples.length / this.frames, 1)
  }
}

// ── landmark access (mirrored view, like the Python engine's flipped frame) ──
const mirrored = (lms, i, w, h) => [(1 - lms[i].x) * w, lms[i].y * h]

// ── detectors ──────────────────────────────────────────────────────
export function detectPosture(pose, w, h, calibrators) {
  const vis = (i) => (pose[i]?.visibility ?? 1) >= 0.4
  const at = (i) => (vis(i) ? mirrored(pose, i, w, h) : null)
  const lSh = at(POSE.LEFT_SHOULDER)
  const rSh = at(POSE.RIGHT_SHOULDER)
  if (!lSh || !rSh) return { status: 'Unknown', composite: 0, mode: 'none' }

  const lHi = at(23)
  const rHi = at(24)
  const lEa = at(POSE.LEFT_EAR)
  const rEa = at(POSE.RIGHT_EAR)
  const shMid = [(lSh[0] + rSh[0]) / 2, (lSh[1] + rSh[1]) / 2]
  const shoulderRoll = (Math.abs(lSh[1] - rSh[1]) / Math.max(w, 1)) * 100

  let composite
  let mode
  if (lHi && rHi) {
    // Full torso visible: same formula as the Python engine.
    mode = 'full'
    const hiMid = [(lHi[0] + rHi[0]) / 2, (lHi[1] + rHi[1]) / 2]
    const spine = angleOfVector(hiMid, shMid)
    const neck = lEa && rEa ? angleOfVector(shMid, [(lEa[0] + rEa[0]) / 2, (lEa[1] + rEa[1]) / 2]) : 0
    let lean = 0
    if (shMid[1] < hiMid[1]) {
      const torso = Math.abs(hiMid[1] - shMid[1])
      if (torso > 0) lean = (Math.abs(shMid[0] - hiMid[0]) / Math.max(torso, 1)) * 10
    }
    composite = spine * 0.5 + neck * 0.28 + shoulderRoll * 0.12 + lean * 0.1
  } else {
    // Typical laptop-webcam framing (head and shoulders): hips are out of view, so estimate
    // from head lean, shoulder tilt, and how close the ears sit to the shoulder line.
    mode = 'upper'
    const shoulderWidth = Math.max(dist(lSh, rSh), 1)
    let neck
    let hunch
    if (lEa && rEa) {
      const earMid = [(lEa[0] + rEa[0]) / 2, (lEa[1] + rEa[1]) / 2]
      neck = angleOfVector(shMid, earMid)
      const gap = (shMid[1] - earMid[1]) / shoulderWidth
      hunch = (1 - clamp(gap, 0, 1.2)) * 100
    } else if (vis(POSE.NOSE)) {
      const nose = mirrored(pose, POSE.NOSE, w, h)
      neck = angleOfVector(shMid, nose)
      const gap = (shMid[1] - nose[1]) / shoulderWidth
      hunch = (1 - clamp(gap / 1.3, 0, 1.2)) * 100
    } else {
      return { status: 'Unknown', composite: 0, mode: 'none' }
    }
    composite = neck * 0.3 + shoulderRoll * 0.2 + hunch * 0.5
  }

  const calibrator = calibrators[mode]
  calibrator.feed(composite)
  // The first ~2s only establish the user's own upright baseline, so don't label them yet.
  if (!calibrator.calibrated) return { status: 'Calibrating', composite, mode }
  const adj = calibrator.adjust(composite)

  let status
  if (adj < CONFIG.SPINE_STRAIGHT_MAX) status = 'Straight'
  else if (adj < CONFIG.SPINE_SLIGHT_MAX) status = 'Slightly Slouched'
  else if (adj < CONFIG.SPINE_SLOUCH_MAX) status = 'Slouched'
  else status = 'Heavy Slouch'

  if (composite > 35 && shoulderRoll > 3.5) status = lSh[1] > rSh[1] ? 'Leaning Left' : 'Leaning Right'
  return { status, composite, mode }
}

export function detectHeadPose(face, w, h) {
  const nose = mirrored(face, FACE.NOSE_TIP, w, h)
  const chin = mirrored(face, FACE.CHIN, w, h)
  const a = mirrored(face, FACE.LEFT_CHEEK, w, h)
  const b = mirrored(face, FACE.RIGHT_CHEEK, w, h)
  const [lc, rc] = a[0] <= b[0] ? [a, b] : [b, a] // left/right as seen in the mirrored view
  const faceWidth = Math.max(dist(lc, rc), 1)
  const faceHeight = Math.max(dist(nose, chin), 1)
  const roll = (Math.atan2(rc[1] - lc[1], rc[0] - lc[0]) * 180) / Math.PI

  const lateral = roll > 9 ? 'Tilted Right' : roll < -9 ? 'Tilted Left' : 'Center'
  const noseX = (nose[0] - lc[0]) / faceWidth
  let forward
  if (noseX < 0.33) forward = 'Turned Left'
  else if (noseX > 0.67) forward = 'Turned Right'
  else forward = Math.abs(chin[0] - nose[0]) / faceHeight > 0.2 ? 'Forward' : 'Neutral'
  return { lateral, forward, roll: Math.abs(roll) }
}

export function detectGaze(face, w, h, gazeBuffer) {
  try {
    const p = (i) => mirrored(face, i, w, h)
    const eye = (g) => {
      const a = p(g.outer)
      const b = p(g.inner)
      const left = Math.min(a[0], b[0])
      const width = Math.max(dist(a, b), 1)
      const iris = g.iris.map(p)
      const cx = mean(iris.map((q) => q[0]))
      const cy = mean(iris.map((q) => q[1]))
      const top = p(g.top)
      const height = Math.max(dist(top, p(g.bottom)), 1)
      return { h: (cx - left) / width, v: (cy - top[1]) / height, ear: height / width }
    }
    const e1 = eye(FACE.EYE_A)
    const e2 = eye(FACE.EYE_B)
    if (![e1.h, e1.v, e2.h, e2.v].every(Number.isFinite)) throw new Error('bad landmarks')
    const eyeAr = (e1.ear + e2.ear) / 2
    const [gazeRatio, vertRatio] = gazeBuffer.update((e1.h + e2.h) / 2, (e1.v + e2.v) / 2)

    const atCamera =
      gazeRatio >= CONFIG.GAZE_H_INNER &&
      gazeRatio <= CONFIG.GAZE_H_OUTER &&
      vertRatio >= CONFIG.GAZE_V_INNER &&
      vertRatio <= CONFIG.GAZE_V_OUTER
    let status
    if (eyeAr < CONFIG.EYE_CLOSED_RATIO) status = 'Eyes Closed'
    else if (atCamera) status = 'At Camera'
    else if (gazeRatio < CONFIG.GAZE_H_INNER) status = 'Looking Left'
    else if (gazeRatio > CONFIG.GAZE_H_OUTER) status = 'Looking Right'
    else if (vertRatio < CONFIG.GAZE_V_INNER) status = 'Looking Up'
    else status = 'Looking Down'

    const hDev = Math.abs(gazeRatio - 0.5) * 2
    const vDev = Math.abs(vertRatio - 0.5) * 2
    const attention = Math.max(1 - (hDev * 0.6 + vDev * 0.4), 0)
    return { status, gazeRatio, vertRatio, attention, eyeAr }
  } catch {
    return { status: 'Unknown', gazeRatio: 0.5, vertRatio: 0.5, attention: 0.5, eyeAr: 0.25 }
  }
}

/**
 * The Python engine called any closed mouth a smile (inner-lip width / inner-lip gap is huge
 * when the lips touch), so this uses MediaPipe's blendshape scores instead.
 */
export function detectExpression(face, blendshapes, w, h) {
  try {
    const p = (i) => mirrored(face, i, w, h)
    const ear = (g) => dist(p(g.top), p(g.bottom)) / Math.max(dist(p(g.outer), p(g.inner)), 1)
    const avgEar = (ear(FACE.EYE_A) + ear(FACE.EYE_B)) / 2
    const bs = blendshapes || {}
    const smile = ((bs.mouthSmileLeft ?? 0) + (bs.mouthSmileRight ?? 0)) / 2
    const brow = ((bs.browDownLeft ?? 0) + (bs.browDownRight ?? 0)) / 2
    const blinking = avgEar < CONFIG.BLINK_THRESHOLD

    let label = 'Neutral'
    if (smile > CONFIG.SMILE_BLENDSHAPE_MIN && !blinking && avgEar > 0.18) label = 'Smiling'
    else if (avgEar < CONFIG.EYE_CLOSED_RATIO) label = 'Eyes Closed'
    else if (blinking) label = 'Blinking'
    else if (brow > CONFIG.BROW_TENSION_MIN) label = 'Tense'
    return { label, smile, avgEar, brow }
  } catch {
    return { label: 'Unknown', smile: 0, avgEar: 0.25, brow: 0 }
  }
}

export function classifyHand(hand, w, h) {
  const pt = (i) => [hand[i].x * w, hand[i].y * h]
  const wrist = pt(0)
  let extended = 0
  for (let k = 1; k < FINGERTIPS.length; k += 1) {
    if (dist(pt(FINGERTIPS[k]), wrist) > dist(pt(FINGER_MIDS[k]), wrist) * 1.05) extended += 1
  }
  if (dist(pt(4), wrist) > dist(pt(3), wrist)) extended += 1
  if (extended >= 4) return 'Open Palm'
  if (extended === 0) return 'Closed Fist'
  if (extended === 1) return 'Pointing'
  return 'Partial'
}

export function detectGestures(hands, w, h) {
  if (!hands || hands.length === 0) return { label: 'No Hands', count: 0 }
  const labels = hands.map((hand) => classifyHand(hand, w, h))
  return { label: labels.length >= 2 ? `${labels[0]} / ${labels[1]}` : labels[0], count: labels.length }
}

export function detectMovement(pose, w, h, state, fps) {
  const c = state.lastValid
  TRACKED_POSE.forEach((idx, i) => {
    if ((pose[idx]?.visibility ?? 1) >= 0.4) {
      const x = 1 - pose[idx].x
      const y = pose[idx].y
      c[i * 2] = c[i * 2] === null ? x : CONFIG.EXP_SMOOTH_ALPHA * x + (1 - CONFIG.EXP_SMOOTH_ALPHA) * c[i * 2]
      c[i * 2 + 1] = c[i * 2 + 1] === null ? y : CONFIG.EXP_SMOOTH_ALPHA * y + (1 - CONFIG.EXP_SMOOTH_ALPHA) * c[i * 2 + 1]
    }
  })
  const row = c.map((v) => (v === null ? 0.5 : v))
  state.history.push(row)
  if (state.history.length > state.size) state.history.shift()
  if (state.history.length < 5) return { label: 'Calibrating', variance: 0 }

  const n = state.history.length
  const cols = row.length
  let varSum = 0
  for (let j = 0; j < cols; j += 1) {
    const m = mean(state.history.map((r) => r[j]))
    varSum += mean(state.history.map((r) => (r[j] - m) ** 2))
  }
  const variance = varSum / cols
  const last3 = state.history.slice(-3)
  let velSum = 0
  let velN = 0
  for (let t = 1; t < last3.length; t += 1) {
    for (let j = 0; j < cols; j += 1) {
      velSum += Math.abs(last3[t][j] - last3[t - 1][j])
      velN += 1
    }
  }
  const velocity = (velSum / Math.max(velN, 1)) * (fps / 30) // per-frame motion at 30 fps equivalent
  const combined = n >= 3 ? variance * 0.65 + velocity * 0.35 : variance

  let label
  if (combined < CONFIG.MOVEMENT_STABLE_MAX) label = 'Stable'
  else if (combined < CONFIG.MOVEMENT_MODERATE_MAX) label = 'Moderate'
  else if (combined < CONFIG.MOVEMENT_RESTLESS_MIN) label = 'Active'
  else label = 'Restless'
  return { label, variance }
}

// ── scoring ────────────────────────────────────────────────────────
export function calculateScores({ posture, movement, gaze, expression, gesture, composite, variance, gazeAttention }) {
  let postureScore
  if (posture === 'Straight') postureScore = Math.max(10 - composite * 0.2, 7.5)
  else if (posture === 'Slightly Slouched') postureScore = Math.max(10 - composite * 0.4, 4.0)
  else if (posture === 'Slouched') postureScore = Math.max(10 - composite * 0.55, 2.0)
  else if (posture === 'Heavy Slouch') postureScore = Math.max(10 - composite * 0.7, 0.5)
  else if (posture === 'Leaning Left' || posture === 'Leaning Right') postureScore = 4.5
  else postureScore = 5.0

  let movementScore
  if (movement === 'Stable') movementScore = 10.0
  else if (movement === 'Moderate') movementScore = Math.max(10 - variance * 650, 6.0)
  else if (movement === 'Active') movementScore = Math.max(10 - variance * 900, 4.0)
  else if (movement === 'Restless') movementScore = Math.max(10 - variance * 1200, 0.0)
  else movementScore = 5.0

  const eyeMap = { 'At Camera': 10.0, 'Looking Left': 3.5, 'Looking Right': 3.5, 'Looking Up': 4.5, 'Looking Down': 2.5, 'Eyes Closed': 1.0, Unknown: 5.0 }
  const eyeScore = eyeMap[gaze] ?? 5.0
  const exprMap = { Smiling: 10.0, Neutral: 7.5, Blinking: 5.0, Tense: 4.0, 'Eyes Closed': 2.0, Unknown: 5.0 }
  const expressionScore = exprMap[expression] ?? 5.0
  const gestMap = { 'No Hands': 6.0, 'Open Palm': 10.0, Pointing: 8.0, Partial: 7.0, 'Closed Fist': 4.0 }
  const gestureScore = gestMap[String(gesture).split(' / ')[0].trim()] ?? 5.0

  const engagement = eyeScore * 0.35 + expressionScore * 0.25 + postureScore * 0.2 + gestureScore * 0.1 + movementScore * 0.1
  const attention = gazeAttention * 10 * 0.5 + eyeScore * 0.3 + movementScore * 0.2
  const cap = (x) => round1(Math.min(x, 10))
  return {
    posture: cap(postureScore),
    movement: cap(movementScore),
    eye: cap(eyeScore),
    expression: cap(expressionScore),
    gesture: cap(gestureScore),
    engagement: cap(engagement),
    attention: cap(attention),
  }
}

// ── events / warnings ──────────────────────────────────────────────
class EventDetector {
  constructor(fps) {
    this.events = []
    this.lastFired = {}
    this.gazeAwayStart = null
    this.downBuf = []
    // 3s window: the Python engine used 1s, which flagged any quick glance at notes.
    this.downSize = windowFor(90, fps)
    this.postureBadStart = null
    this.eyeClosedStart = null
    this.faceGoneStart = null
    this.lastSpike = -999
    this.restlessStart = null
    this.distractions = 0
  }

  fire(type, detail, now, severity) {
    if (now - (this.lastFired[type] ?? -9999) < (WARNING_COOLDOWN[type] ?? 8.0)) return false
    this.lastFired[type] = now
    if (this.events.length < CONFIG.MAX_EVENTS) this.events.push({ time: round1(now), type, detail, severity })
    return true
  }

  update(now, { gaze, posture, variance, eyeAr, faceVisible, movement }) {
    // "Face Not Visible" and "Eyes Closed" have their own warnings, so only a visible face
    // that is clearly pointed somewhere else counts as a gaze break.
    const lookingAway = faceVisible && gaze !== 'At Camera' && gaze !== 'Unknown' && gaze !== 'Eyes Closed' && gaze !== 'Calibrating'
    if (lookingAway) {
      if (this.gazeAwayStart === null) this.gazeAwayStart = now
      else if (now - this.gazeAwayStart >= CONFIG.GAZE_BREAK_DURATION) {
        if (this.fire('Prolonged Gaze Break', `Looked away (${gaze}) for ${(now - this.gazeAwayStart).toFixed(1)}s`, now, 'medium')) {
          this.distractions += 1
          this.gazeAwayStart = now
        }
      }
    } else this.gazeAwayStart = null

    this.downBuf.push(gaze === 'Looking Down' ? 1 : 0)
    if (this.downBuf.length > this.downSize) this.downBuf.shift()
    if (this.downBuf.length === this.downSize) {
      const ratio = mean(this.downBuf)
      if (ratio > 0.55) this.fire('Repeated Downward Gaze', `Looking down ${Math.round(ratio * 100)}% of the time`, now, 'medium')
    }

    if (!['Straight', 'Calibrating', 'No Pose', 'Unknown'].includes(posture)) {
      if (this.postureBadStart === null) this.postureBadStart = now
      else if (now - this.postureBadStart >= CONFIG.POSTURE_INSTABILITY_SEC) {
        const heavy = posture === 'Heavy Slouch'
        if (this.fire(heavy ? 'Heavy Slouch' : 'Posture Instability', `Posture (${posture}) for ${(now - this.postureBadStart).toFixed(1)}s`, now, heavy ? 'high' : 'medium')) {
          this.postureBadStart = now
        }
      }
    } else this.postureBadStart = null

    if (variance > CONFIG.MOVEMENT_SPIKE_VAR && now - this.lastSpike > 5.0) {
      if (this.fire('High Movement Variance', `Movement variance ${variance.toFixed(4)}`, now, 'medium')) this.lastSpike = now
    }

    if (movement === 'Restless') {
      if (this.restlessStart === null) this.restlessStart = now
      else if (now - this.restlessStart >= 6.0) {
        if (this.fire('Restless Behavior', 'Sustained elevated movement', now, 'high')) this.restlessStart = now
      }
    } else this.restlessStart = null

    if (eyeAr < CONFIG.EYE_CLOSED_RATIO) {
      if (this.eyeClosedStart === null) this.eyeClosedStart = now
      else if (now - this.eyeClosedStart >= CONFIG.EYE_CLOSURE_WARN_SEC) {
        if (this.fire('Eyes Closed', 'Prolonged eye closure', now, 'high')) this.eyeClosedStart = now
      }
    } else this.eyeClosedStart = null

    if (!faceVisible) {
      if (this.faceGoneStart === null) this.faceGoneStart = now
      else if (now - this.faceGoneStart >= CONFIG.FACE_GONE_WARN_SEC) {
        if (this.fire('Face Not Visible', 'Face was out of frame', now, 'high')) this.faceGoneStart = now
      }
    } else this.faceGoneStart = null
  }
}

const trendOf = (arr) => {
  if (arr.length < 6) return 'insufficient data'
  const mid = arr.length >> 1
  const delta = mean(arr.slice(mid)) - mean(arr.slice(0, mid))
  return delta > 0.5 ? 'improving' : delta < -0.5 ? 'declining' : 'stable'
}

// ── analyzer ───────────────────────────────────────────────────────
export class BehaviorAnalyzer {
  constructor({ fps = 10 } = {}) {
    this.fps = fps
    const st = windowFor(12, fps)
    this.postureBuf = new StateBuffer(st, 'Calibrating')
    this.movementBuf = new StateBuffer(st, 'Calibrating')
    this.gazeBuf = new StateBuffer(st, 'Calibrating')
    this.expressionBuf = new StateBuffer(st, 'Calibrating')
    this.gestureBuf = new StateBuffer(st, 'No Hands')
    this.lateralBuf = new StateBuffer(st, 'Center')
    this.forwardBuf = new StateBuffer(st, 'Neutral')
    const sc = windowFor(18, fps)
    this.sb = Object.fromEntries(['posture', 'movement', 'eye', 'expression', 'gesture', 'engagement', 'attention'].map((k) => [k, new ScoreBuffer(sc)]))
    this.gazeRatioBuf = new GazeBuffer(windowFor(10, fps))
    const calFrames = windowFor(60, fps)
    this.calibrators = { full: new PostureCalibrator(calFrames), upper: new PostureCalibrator(calFrames) }
    this.move = { history: [], size: windowFor(25, fps), lastValid: new Array(TRACKED_POSE.length * 2).fill(null) }
    this.events = new EventDetector(fps)
    this.logs = []
    this.lastLogAt = -Infinity
    this.frames = 0
    this.lastT = 0
    this.current = null
  }

  sampleCount() {
    return this.logs.length
  }

  /** @param {{t:number,w:number,h:number,pose:any[]|null,face:any[]|null,blendshapes?:Record<string,number>,hands?:any[][]}} f */
  process(f) {
    const { t, w, h } = f
    this.frames += 1
    this.lastT = t

    let postureRaw = { status: 'No Pose', composite: 0, mode: 'none' }
    let movementRaw = { label: 'No Pose', variance: 0 }
    let lateral = 'Unknown'
    let forward = 'Unknown'
    let gazeRaw = { status: 'Unknown', attention: 0.5, eyeAr: 0.25 }
    let exprRaw = { label: 'Unknown' }

    if (f.pose) {
      postureRaw = detectPosture(f.pose, w, h, this.calibrators)
      movementRaw = detectMovement(f.pose, w, h, this.move, this.fps)
    }
    const faceVisible = Boolean(f.face)
    if (f.face) {
      const head = detectHeadPose(f.face, w, h)
      lateral = head.lateral
      forward = head.forward
      gazeRaw = detectGaze(f.face, w, h, this.gazeRatioBuf)
      exprRaw = detectExpression(f.face, f.blendshapes, w, h)
    }
    const gestureRaw = detectGestures(f.hands, w, h)

    const posture = this.postureBuf.update(postureRaw.status)
    const movement = this.movementBuf.update(movementRaw.label)
    const gaze = this.gazeBuf.update(gazeRaw.status)
    const expression = this.expressionBuf.update(exprRaw.label)
    const gesture = this.gestureBuf.update(gestureRaw.label)
    lateral = this.lateralBuf.update(lateral)
    forward = this.forwardBuf.update(forward)

    const raw = calculateScores({
      posture,
      movement,
      gaze,
      expression,
      gesture,
      composite: postureRaw.composite,
      variance: movementRaw.variance,
      gazeAttention: gazeRaw.attention,
    })
    const scores = {}
    for (const k of Object.keys(raw)) scores[k] = this.sb[k].update(raw[k])
    scores.overall = round1((scores.posture + scores.movement + scores.eye + scores.expression + scores.gesture) / 5)

    this.events.update(t, { gaze, posture, variance: movementRaw.variance, eyeAr: gazeRaw.eyeAr, faceVisible, movement })

    if (t - this.lastLogAt >= CONFIG.LOG_INTERVAL_SEC) {
      this.lastLogAt = t
      this.logs.push({ t, posture, movement, gaze, expression, gesture, faceVisible, gazeAttention: gazeRaw.attention, scores: { ...scores } })
      if (this.logs.length > CONFIG.MAX_LOGS) this.logs.shift()
    }

    const calibrator = this.calibrators[postureRaw.mode === 'none' ? 'upper' : postureRaw.mode]
    this.current = {
      faceVisible,
      poseVisible: Boolean(f.pose),
      posture,
      postureMode: postureRaw.mode,
      movement,
      gaze,
      expression,
      gesture,
      lateral,
      forward,
      scores,
      calibration: calibrator.progress,
    }
    return this.current
  }

  summary() {
    const logs = this.logs
    const n = logs.length
    if (!n) return null
    const avg = (pick) => mean(logs.map(pick))
    const pct = (pred) => round1((logs.filter(pred).length / n) * 100)
    const a = {
      posture: avg((l) => l.scores.posture),
      movement: avg((l) => l.scores.movement),
      eyeContact: avg((l) => l.scores.eye),
      expression: avg((l) => l.scores.expression),
      gesture: avg((l) => l.scores.gesture),
      engagement: avg((l) => l.scores.engagement),
      attention: avg((l) => l.scores.attention),
    }
    const overall = (a.posture + a.movement + a.eyeContact + a.expression + a.gesture) / 5
    // Hands are usually out of frame on a laptop webcam; "No Hands" is a neutral 6.0, not a
    // weakness, so gesture only competes for strongest/weakest when it was actually observed.
    const noHandsPct = pct((l) => l.gesture === 'No Hands')
    const gestureObserved = noHandsPct < 80
    const signals = { posture: a.posture, movement: a.movement, eyeContact: a.eyeContact, expression: a.expression }
    if (gestureObserved) signals.gesture = a.gesture
    const strongest = Object.keys(signals).reduce((x, y) => (signals[y] > signals[x] ? y : x))
    const weakest = Object.keys(signals).reduce((x, y) => (signals[y] < signals[x] ? y : x))
    const eventCounts = {}
    for (const e of this.events.events) eventCounts[e.type] = (eventCounts[e.type] ?? 0) + 1

    return {
      durationSeconds: round1(this.lastT),
      samples: n,
      avgScores: {
        posture: round2(a.posture),
        movement: round2(a.movement),
        eyeContact: round2(a.eyeContact),
        expression: round2(a.expression),
        gesture: round2(a.gesture),
        overall: round2(overall),
        engagement: round2(a.engagement),
        attention: round2(a.attention),
      },
      percentages: {
        faceVisiblePct: pct((l) => l.faceVisible),
        uprightPosturePct: pct((l) => l.posture === 'Straight'),
        atCameraGazePct: pct((l) => l.gaze === 'At Camera'),
        downwardGazePct: pct((l) => l.gaze === 'Looking Down'),
        stableMovementPct: pct((l) => l.movement === 'Stable'),
        restlessMovementPct: pct((l) => l.movement === 'Restless'),
        smilingPct: pct((l) => l.expression === 'Smiling'),
        neutralExpressionPct: pct((l) => l.expression === 'Neutral'),
        openPalmPct: pct((l) => l.gesture.includes('Open Palm')),
        noHandsPct,
        avgGazeAttention: round2(avg((l) => l.gazeAttention)),
      },
      gestureObserved,
      strongestSignal: strongest,
      weakestSignal: weakest,
      behavioralPresence: round2(overall * 0.6 + a.engagement * 0.25 + a.attention * 0.15),
      eventCounts,
      totalEvents: this.events.events.length,
      events: this.events.events.slice(0, 50),
      trends: {
        posture: trendOf(logs.map((l) => l.scores.posture)),
        movement: trendOf(logs.map((l) => l.scores.movement)),
        eyeContact: trendOf(logs.map((l) => l.scores.eye)),
        overall: trendOf(logs.map((l) => (l.scores.posture + l.scores.movement + l.scores.eye + l.scores.expression + l.scores.gesture) / 5)),
        engagement: trendOf(logs.map((l) => l.scores.engagement)),
        attention: trendOf(logs.map((l) => l.scores.attention)),
      },
    }
  }
}
