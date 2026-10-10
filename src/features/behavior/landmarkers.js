// Loads the MediaPipe Tasks Vision runtime and its three landmark models on demand.
//
// The WASM runtime (~13 MB) and the models (~17 MB) are fetched from public CDNs the first time
// a candidate starts an interview and then come from the browser cache. This module is only ever
// reached through a dynamic import() from useBehaviorAnalysis, so none of it is in the main bundle.

const VISION_VERSION = '1.1.0' // keep in sync with the @mediapipe/tasks-vision dependency
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`
const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models'
const MODELS = {
  face: { url: `${MODEL_BASE}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, bytes: 3_758_596 },
  pose: { url: `${MODEL_BASE}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`, bytes: 5_777_746 },
  hand: { url: `${MODEL_BASE}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, bytes: 7_819_105 },
}
const TOTAL_MODEL_BYTES = Object.values(MODELS).reduce((sum, m) => sum + m.bytes, 0)

// Upper-body pose connections only (shoulders, arms, torso); the face has its own overlay.
const isUpperBody = ({ start, end }) => start >= 11 && end <= 24

let instance = null
let pending = null
let modelBuffers = null
const progressListeners = new Set()

function emitProgress(fraction) {
  for (const listener of progressListeners) listener(Math.min(Math.max(fraction, 0), 1))
}

async function fetchModel(url, onBytes) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Model download failed (${res.status})`)
  if (!res.body?.getReader) {
    const buf = new Uint8Array(await res.arrayBuffer())
    onBytes(buf.length)
    return buf
  }
  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onBytes(value.length)
  }
  const out = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function downloadModels() {
  if (!modelBuffers) {
    let loaded = 0
    const onBytes = (n) => {
      loaded += n
      emitProgress(loaded / TOTAL_MODEL_BYTES)
    }
    modelBuffers = Promise.all(Object.values(MODELS).map((m) => fetchModel(m.url, onBytes)))
      .then(([face, pose, hand]) => ({ face, pose, hand }))
      .catch((error) => {
        modelBuffers = null // allow a retry to download again
        throw error
      })
  }
  return modelBuffers
}

async function createTasks(vision, buffers, delegate) {
  const { FilesetResolver, FaceLandmarker, PoseLandmarker, HandLandmarker } = vision
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  // Each task gets its own copy of the model bytes, so a CPU retry can reuse the downloads.
  const base = (key) => ({ modelAssetBuffer: new Uint8Array(buffers[key]), delegate })
  // Created one after another: parallel createFromOptions calls race on the shared WASM loader.
  const face = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: base('face'),
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  })
  const pose = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: base('pose'),
    runningMode: 'VIDEO',
    numPoses: 1,
  })
  const hand = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: base('hand'),
    runningMode: 'VIDEO',
    numHands: 2,
  })
  return { face, pose, hand }
}

function closeTasks(tasks) {
  for (const task of Object.values(tasks ?? {})) {
    try {
      task.close()
    } catch {
      // already closed
    }
  }
}

async function load() {
  const [vision, buffers] = await Promise.all([import('@mediapipe/tasks-vision'), downloadModels()])

  let delegate = 'GPU'
  let tasks
  try {
    tasks = await createTasks(vision, buffers, 'GPU')
  } catch (error) {
    console.warn('[behavior] GPU delegate unavailable, falling back to CPU', error)
    delegate = 'CPU'
    tasks = await createTasks(vision, buffers, 'CPU')
  }

  const landmarkers = {
    vision,
    get delegate() {
      return delegate
    },

    /** Swap to CPU inference; used when the GPU delegate fails after a successful load. */
    async useCpu() {
      if (delegate === 'CPU') return
      closeTasks(tasks)
      tasks = await createTasks(vision, buffers, 'CPU')
      delegate = 'CPU'
    },

    /**
     * Runs all landmark models on one video frame. `hands` is null when the (more expensive,
     * rarely needed) hand model was skipped for this frame, so callers can reuse the last result.
     */
    detect(video, timestampMs, { withHands = true } = {}) {
      const faceRes = tasks.face.detectForVideo(video, timestampMs)
      const poseRes = tasks.pose.detectForVideo(video, timestampMs)
      const handRes = withHands ? tasks.hand.detectForVideo(video, timestampMs) : null

      const blendshapes = {}
      for (const category of faceRes.faceBlendshapes?.[0]?.categories ?? []) {
        blendshapes[category.categoryName] = category.score
      }
      return {
        face: faceRes.faceLandmarks?.[0] ?? null,
        blendshapes,
        pose: poseRes.landmarks?.[0] ?? null,
        hands: handRes ? (handRes.landmarks ?? []) : null,
      }
    },

    close() {
      closeTasks(tasks)
      instance = null
    },
  }
  return landmarkers
}

/**
 * Resolves with the shared landmarkers, loading them on first use. Safe to call from several
 * mounts at once (React StrictMode); all callers receive progress updates (0..1) while loading.
 */
export function loadLandmarkers({ onProgress } = {}) {
  if (instance) return Promise.resolve(instance)
  if (onProgress) progressListeners.add(onProgress)
  if (!pending) {
    pending = load()
      .then((loaded) => {
        instance = loaded
        return loaded
      })
      .finally(() => {
        pending = null
      })
  }
  return pending.finally(() => {
    if (onProgress) progressListeners.delete(onProgress)
  })
}

/** Draws face contours, upper body and hands onto a canvas the size of the video frame. */
const drawers = new WeakMap()
export function drawOverlay(canvas, vision, frame) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  let utils = drawers.get(canvas)
  if (!utils) {
    utils = new vision.DrawingUtils(ctx)
    drawers.set(canvas, utils)
  }
  const { FaceLandmarker, PoseLandmarker, HandLandmarker } = vision
  const line = Math.max(canvas.width / 320, 1.5)
  if (frame.face) {
    utils.drawConnectors(frame.face, FaceLandmarker.FACE_LANDMARKS_CONTOURS, { color: 'rgba(52, 211, 153, 0.75)', lineWidth: line })
  }
  if (frame.pose) {
    const upper = PoseLandmarker.POSE_CONNECTIONS.filter(isUpperBody)
    utils.drawConnectors(frame.pose, upper, { color: 'rgba(125, 211, 252, 0.7)', lineWidth: line })
  }
  for (const hand of frame.hands ?? []) {
    utils.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, { color: 'rgba(251, 191, 36, 0.85)', lineWidth: line })
  }
}
