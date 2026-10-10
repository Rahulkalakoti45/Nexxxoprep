import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BehaviorAnalyzer,
  PostureCalibrator,
  calculateScores,
  classifyHand,
  detectExpression,
  detectGaze,
  detectGestures,
  detectHeadPose,
  detectMovement,
  detectPosture,
  windowFor,
} from './analysis.js'

const W = 640
const H = 480

// ── synthetic landmark builders (raw, un-mirrored camera coordinates) ──
function makeFace({ gazeH = 0.5, gazeV = 0.5, eyeHeight = 0.016, noseX = 0.5, tilt = 0 } = {}) {
  const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const set = (i, x, y) => {
    face[i] = { x, y, z: 0 }
  }
  set(1, noseX, 0.5)
  set(152, 0.5, 0.68)
  set(234, 0.42, 0.5 - tilt)
  set(454, 0.58, 0.5 + tilt)

  // Eye A = subject's right eye (raw image-left). Mirrored view: inner 0.52 .. outer 0.56.
  // Eye B = subject's left eye (raw image-right). Mirrored view: outer 0.44 .. inner 0.48.
  // Iris x is placed so the *mirrored* horizontal ratio equals gazeH.
  const eyes = [
    { outer: 33, inner: 133, top: 159, bottom: 145, iris: [469, 470, 471, 472], rawOuter: 0.44, rawInner: 0.48, mirroredLeft: 0.52 },
    { outer: 263, inner: 362, top: 386, bottom: 374, iris: [474, 475, 476, 477], rawOuter: 0.56, rawInner: 0.52, mirroredLeft: 0.44 },
  ]
  for (const e of eyes) {
    const cy = 0.46
    const top = cy - eyeHeight / 2
    set(e.outer, e.rawOuter, cy)
    set(e.inner, e.rawInner, cy)
    set(e.top, (e.rawOuter + e.rawInner) / 2, top)
    set(e.bottom, (e.rawOuter + e.rawInner) / 2, top + eyeHeight)
    const mirroredX = e.mirroredLeft + gazeH * 0.04
    const iy = top + gazeV * eyeHeight
    const r = 0.003
    const rawX = 1 - mirroredX
    set(e.iris[0], rawX, iy - r)
    set(e.iris[1], rawX + r, iy)
    set(e.iris[2], rawX, iy + r)
    set(e.iris[3], rawX - r, iy)
  }
  return face
}

function makePose({ earY = 0.47, leftShoulderY = 0.75, rightShoulderY = 0.75, hips = false, dx = 0, dy = 0 } = {}) {
  const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }))
  const set = (i, x, y, visibility = 1) => {
    pose[i] = { x: x + dx, y: y + dy, z: 0, visibility }
  }
  set(0, 0.5, 0.45)
  set(7, 0.55, earY)
  set(8, 0.45, earY)
  set(11, 0.62, leftShoulderY)
  set(12, 0.38, rightShoulderY)
  set(15, 0.7, 0.95)
  set(16, 0.3, 0.95)
  if (hips) {
    // A real torso is never perfectly vertical; a composite of exactly 0 is ignored by the calibrator.
    set(23, 0.58, 1.0)
    set(24, 0.4, 1.0)
  }
  return pose
}

function makeHand(extended) {
  // extended = [thumb, index, middle, ring, pinky]
  const hand = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }))
  const tips = [4, 8, 12, 16, 20]
  const mids = [3, 6, 10, 14, 18]
  extended.forEach((isOut, i) => {
    const x = 0.4 + i * 0.05
    hand[mids[i]] = { x, y: 0.8 - 0.12, z: 0 }
    hand[tips[i]] = { x, y: isOut ? 0.8 - 0.22 : 0.8 - 0.08, z: 0 }
  })
  return hand
}

const calibrators = () => ({ full: new PostureCalibrator(20), upper: new PostureCalibrator(20) })
const calibrated = (poseOpts = {}) => {
  const c = calibrators()
  for (let i = 0; i < 20; i += 1) detectPosture(makePose(poseOpts), W, H, c)
  return c
}

// ── helpers ────────────────────────────────────────────────────────
test('windowFor scales 30fps frame counts to the analysis rate', () => {
  assert.equal(windowFor(60, 30), 60)
  assert.equal(windowFor(60, 10), 20)
  assert.equal(windowFor(12, 10), 4)
  assert.equal(windowFor(1, 10), 3, 'never smaller than 3 frames')
})

test('PostureCalibrator takes the 25th percentile minus a margin, floored at zero', () => {
  const c = new PostureCalibrator(5)
  for (const v of [30, 32, 34, 36, 38]) c.feed(v)
  assert.equal(c.calibrated, true)
  assert.equal(c.offset, 24) // p25 of [30, 32, 34, 36, 38] is 32; minus the 8-point margin
  assert.equal(c.adjust(30), 6)
  assert.equal(c.adjust(10), 0, 'never negative')

  const low = new PostureCalibrator(3)
  for (const v of [2, 3, 4]) low.feed(v)
  assert.equal(low.offset, 0, 'offset floors at zero')
})

// ── posture ────────────────────────────────────────────────────────
test('posture is "Calibrating" until a baseline is collected, then Straight for an upright user', () => {
  const c = calibrators()
  assert.equal(detectPosture(makePose(), W, H, c).status, 'Calibrating')
  for (let i = 0; i < 20; i += 1) detectPosture(makePose(), W, H, c)
  const r = detectPosture(makePose(), W, H, c)
  assert.equal(r.status, 'Straight')
  assert.equal(r.mode, 'upper', 'no hips in frame -> upper-body mode')
})

test('posture gets worse as the head sinks toward the shoulders (head-and-shoulders framing)', () => {
  const c = calibrated()
  assert.equal(detectPosture(makePose({ earY: 0.47 }), W, H, c).status, 'Straight')
  assert.equal(detectPosture(makePose({ earY: 0.58 }), W, H, c).status, 'Slightly Slouched')
  assert.equal(detectPosture(makePose({ earY: 0.64 }), W, H, c).status, 'Slouched')
  assert.equal(detectPosture(makePose({ earY: 0.7 }), W, H, c).status, 'Heavy Slouch')
})

test('posture reports a lean when slouched with a tilted shoulder line', () => {
  const c = calibrated()
  const r = detectPosture(makePose({ earY: 0.66, leftShoulderY: 0.78, rightShoulderY: 0.72 }), W, H, c)
  assert.equal(r.status, 'Leaning Left')
})

test('posture is Unknown when the shoulders are not visible', () => {
  const pose = makePose()
  pose[11].visibility = 0.1
  assert.equal(detectPosture(pose, W, H, calibrators()).status, 'Unknown')
})

test('posture uses the full-torso formula when hips are visible', () => {
  const c = calibrators()
  for (let i = 0; i < 20; i += 1) detectPosture(makePose({ hips: true }), W, H, c)
  const r = detectPosture(makePose({ hips: true }), W, H, c)
  assert.equal(r.mode, 'full')
  assert.equal(r.status, 'Straight')
})

// ── head pose ──────────────────────────────────────────────────────
test('head pose: centered, turned, tilted', () => {
  assert.deepEqual(
    (({ lateral, forward }) => ({ lateral, forward }))(detectHeadPose(makeFace(), W, H)),
    { lateral: 'Center', forward: 'Neutral' },
  )
  assert.equal(detectHeadPose(makeFace({ noseX: 0.6 }), W, H).forward, 'Turned Left', 'raw nose right = mirrored left')
  assert.equal(detectHeadPose(makeFace({ noseX: 0.4 }), W, H).forward, 'Turned Right')
  assert.notEqual(detectHeadPose(makeFace({ tilt: 0.05 }), W, H).lateral, 'Center')
})

// ── gaze ───────────────────────────────────────────────────────────
const gazeOf = (opts) => {
  const buf = { update: (h, v) => [h, v] } // no smoothing, to test classification only
  return detectGaze(makeFace(opts), W, H, buf)
}

test('gaze: looking at the camera', () => {
  const g = gazeOf({})
  assert.equal(g.status, 'At Camera')
  assert.ok(Math.abs(g.gazeRatio - 0.5) < 0.01)
  assert.ok(g.attention > 0.95)
})

test('gaze: left/right/up/down in the mirrored view', () => {
  assert.equal(gazeOf({ gazeH: 0.1 }).status, 'Looking Left')
  assert.equal(gazeOf({ gazeH: 0.9 }).status, 'Looking Right')
  assert.equal(gazeOf({ gazeV: 0.05 }).status, 'Looking Up')
  assert.equal(gazeOf({ gazeV: 0.95 }).status, 'Looking Down')
})

test('gaze: closed eyes', () => {
  assert.equal(gazeOf({ eyeHeight: 0.002 }).status, 'Eyes Closed')
})

test('gaze degrades to Unknown instead of throwing on bad landmarks', () => {
  const g = detectGaze([], W, H, { update: (h, v) => [h, v] })
  assert.equal(g.status, 'Unknown')
})

// ── expression ─────────────────────────────────────────────────────
test('expression: smile comes from blendshapes, a closed mouth alone is Neutral', () => {
  const face = makeFace()
  assert.equal(detectExpression(face, {}, W, H).label, 'Neutral')
  assert.equal(detectExpression(face, { mouthSmileLeft: 0.7, mouthSmileRight: 0.6 }, W, H).label, 'Smiling')
  assert.equal(detectExpression(face, { browDownLeft: 0.8, browDownRight: 0.7 }, W, H).label, 'Tense')
  assert.equal(detectExpression(makeFace({ eyeHeight: 0.002 }), {}, W, H).label, 'Eyes Closed')
  assert.equal(detectExpression(makeFace({ eyeHeight: 0.0095 }), {}, W, H).label, 'Blinking')
})

// ── gestures ───────────────────────────────────────────────────────
test('gestures: open palm, fist, pointing, none, two hands', () => {
  assert.equal(classifyHand(makeHand([true, true, true, true, true]), W, H), 'Open Palm')
  assert.equal(classifyHand(makeHand([false, false, false, false, false]), W, H), 'Closed Fist')
  assert.equal(classifyHand(makeHand([false, true, false, false, false]), W, H), 'Pointing')
  assert.equal(classifyHand(makeHand([false, true, true, false, false]), W, H), 'Partial')
  assert.deepEqual(detectGestures([], W, H), { label: 'No Hands', count: 0 })
  assert.deepEqual(detectGestures(undefined, W, H), { label: 'No Hands', count: 0 })
  const two = detectGestures([makeHand([true, true, true, true, true]), makeHand([false, false, false, false, false])], W, H)
  assert.deepEqual(two, { label: 'Open Palm / Closed Fist', count: 2 })
})

// ── movement ───────────────────────────────────────────────────────
const moveState = () => ({ history: [], size: 8, lastValid: new Array(10).fill(null) })

test('movement: still body is Stable, big oscillation is Restless', () => {
  const still = moveState()
  let r
  for (let i = 0; i < 12; i += 1) r = detectMovement(makePose(), W, H, still, 10)
  assert.equal(r.label, 'Stable')

  const jitter = moveState()
  for (let i = 0; i < 16; i += 1) {
    const d = i % 2 ? 0.2 : -0.2
    r = detectMovement(makePose({ dx: d, dy: d }), W, H, jitter, 10)
  }
  assert.equal(r.label, 'Restless')
})

test('movement: reports Calibrating until enough frames', () => {
  const s = moveState()
  assert.equal(detectMovement(makePose(), W, H, s, 10).label, 'Calibrating')
})

// ── scoring ────────────────────────────────────────────────────────
test('calculateScores: ideal behavior scores near the top', () => {
  const s = calculateScores({
    posture: 'Straight',
    movement: 'Stable',
    gaze: 'At Camera',
    expression: 'Smiling',
    gesture: 'Open Palm',
    composite: 6.25,
    variance: 0,
    gazeAttention: 1,
  })
  assert.equal(s.posture, 8.8)
  assert.equal(s.eye, 10)
  assert.equal(s.expression, 10)
  assert.equal(s.engagement, 9.8)
  assert.equal(s.attention, 10)
})

test('calculateScores: poor behavior scores low and stays within 0..10', () => {
  const s = calculateScores({
    posture: 'Heavy Slouch',
    movement: 'Restless',
    gaze: 'Looking Down',
    expression: 'Tense',
    gesture: 'Closed Fist',
    composite: 60,
    variance: 0.02,
    gazeAttention: 0.2,
  })
  for (const v of Object.values(s)) assert.ok(v >= 0 && v <= 10, `${v} out of range`)
  assert.ok(s.eye <= 3)
  assert.ok(s.engagement < 5)
})

test('calculateScores: unknown labels fall back to neutral instead of NaN', () => {
  const s = calculateScores({
    posture: 'Calibrating',
    movement: 'Calibrating',
    gaze: 'Whatever',
    expression: 'Whatever',
    gesture: 'Whatever',
    composite: 0,
    variance: 0,
    gazeAttention: 0.5,
  })
  for (const v of Object.values(s)) assert.ok(Number.isFinite(v))
})

// ── analyzer end-to-end ────────────────────────────────────────────
function run(analyzer, seconds, frame, { fps = 10, startFrame = 0 } = {}) {
  let out
  const n = Math.round(seconds * fps)
  for (let i = 0; i < n; i += 1) out = analyzer.process({ t: (startFrame + i) / fps, w: W, h: H, hands: [], blendshapes: {}, ...frame(i) })
  return out
}

test('analyzer: a calm, attentive candidate scores high with no warnings', () => {
  const a = new BehaviorAnalyzer({ fps: 10 })
  const face = makeFace()
  const pose = makePose()
  run(a, 30, () => ({ face, pose }))
  const s = a.summary()
  assert.ok(s)
  assert.equal(s.percentages.faceVisiblePct, 100)
  assert.equal(s.percentages.atCameraGazePct, 100)
  assert.ok(s.avgScores.eyeContact >= 9.9)
  assert.ok(s.avgScores.overall >= 7, `overall was ${s.avgScores.overall}`)
  assert.equal(s.totalEvents, 0)
  assert.equal(s.durationSeconds, 29.9)
  assert.ok(s.samples >= 29 && s.samples <= 31, `1 sample/sec expected, got ${s.samples}`)
  assert.equal(typeof s.behavioralPresence, 'number')
  assert.ok(['posture', 'movement', 'eyeContact', 'expression', 'gesture'].includes(s.strongestSignal))
  assert.ok(['posture', 'movement', 'eyeContact', 'expression', 'gesture'].includes(s.weakestSignal))
})

test('analyzer: live state exposes what the camera card renders', () => {
  const a = new BehaviorAnalyzer({ fps: 10 })
  const cur = run(a, 5, () => ({ face: makeFace(), pose: makePose(), hands: [makeHand([true, true, true, true, true])] }))
  assert.equal(cur.faceVisible, true)
  assert.equal(cur.gaze, 'At Camera')
  assert.equal(cur.gesture, 'Open Palm')
  assert.equal(cur.posture, 'Straight')
  assert.ok(cur.scores.overall > 0 && cur.scores.overall <= 10)
})

test('analyzer: sustained look-away raises a gaze-break warning', () => {
  const a = new BehaviorAnalyzer({ fps: 10 })
  const pose = makePose()
  run(a, 5, () => ({ face: makeFace(), pose }))
  run(a, 8, () => ({ face: makeFace({ gazeH: 0.05 }), pose }), { startFrame: 50 })
  const s = a.summary()
  assert.ok((s.eventCounts['Prolonged Gaze Break'] ?? 0) >= 1, JSON.stringify(s.eventCounts))
  assert.ok(s.percentages.atCameraGazePct < 100)
  assert.equal(s.weakestSignal, 'eyeContact')
})

test('analyzer: gesture only competes for strongest/weakest when hands were actually seen', () => {
  const noHands = new BehaviorAnalyzer({ fps: 10 })
  run(noHands, 20, () => ({ face: makeFace(), pose: makePose() }))
  const s1 = noHands.summary()
  assert.equal(s1.gestureObserved, false)
  assert.notEqual(s1.weakestSignal, 'gesture')
  assert.notEqual(s1.strongestSignal, 'gesture')

  const withHands = new BehaviorAnalyzer({ fps: 10 })
  run(withHands, 20, () => ({ face: makeFace(), pose: makePose(), hands: [makeHand([true, true, true, true, true])] }))
  const s2 = withHands.summary()
  assert.equal(s2.gestureObserved, true)
  assert.equal(s2.percentages.openPalmPct, 100)
})

test('analyzer: face leaving the frame raises a warning and is tracked', () => {
  const a = new BehaviorAnalyzer({ fps: 10 })
  const pose = makePose()
  run(a, 3, () => ({ face: makeFace(), pose }))
  run(a, 5, () => ({ face: null, pose: null }), { startFrame: 30 })
  const s = a.summary()
  assert.ok((s.eventCounts['Face Not Visible'] ?? 0) >= 1, JSON.stringify(s.eventCounts))
  assert.ok(s.percentages.faceVisiblePct < 100)
})

test('analyzer: warnings respect their cooldown instead of firing every frame', () => {
  const a = new BehaviorAnalyzer({ fps: 10 })
  run(a, 30, () => ({ face: null, pose: null }))
  const s = a.summary()
  // 30s with a 5s cooldown is at most ~6 warnings, not one per frame (300).
  assert.ok(s.eventCounts['Face Not Visible'] >= 1 && s.eventCounts['Face Not Visible'] <= 7, JSON.stringify(s.eventCounts))
  assert.equal(s.eventCounts['Prolonged Gaze Break'], undefined, 'a missing face is not a gaze break')
})

test('analyzer: summary is null before any sample and survives empty frames', () => {
  const a = new BehaviorAnalyzer({ fps: 10 })
  assert.equal(a.summary(), null)
  assert.doesNotThrow(() => a.process({ t: 0, w: W, h: H, face: null, pose: null }))
})

test('analyzer: summary is JSON-serialisable with finite numbers only', () => {
  const a = new BehaviorAnalyzer({ fps: 10 })
  run(a, 20, (i) => ({ face: makeFace({ gazeH: i % 40 < 30 ? 0.5 : 0.05 }), pose: makePose({ earY: 0.47 + (i % 50) * 0.002 }) }))
  const s = a.summary()
  const walk = (v) => {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `non-finite number in summary: ${v}`)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(s)
  assert.doesNotThrow(() => JSON.stringify(s))
})
