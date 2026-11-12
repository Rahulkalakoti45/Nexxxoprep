import { gradeRun, prepareTests } from './harness.js'

const JS_TIME_LIMIT_MS = 5000
const PY_TIME_LIMIT_MS = 8000
const PY_LOAD_LIMIT_MS = 90000

let pyWorker = null
let pyReady = null

function resetPython() {
  pyWorker?.terminate()
  pyWorker = null
  pyReady = null
}

/** Starts downloading Python in the background so the first Run is quick. */
export function warmUpPython() {
  if (pyReady) return pyReady
  pyWorker = new Worker(new URL('./pyRunner.worker.js', import.meta.url), { type: 'module' })
  pyReady = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resetPython()
      reject(new Error('Python took too long to load. Check your connection and try again.'))
    }, PY_LOAD_LIMIT_MS)
    const onMessage = (event) => {
      if (event.data?.type === 'ready') {
        clearTimeout(timer)
        pyWorker.removeEventListener('message', onMessage)
        resolve()
      } else if (event.data?.type === 'load-error') {
        clearTimeout(timer)
        resetPython()
        reject(new Error('Python could not be loaded. Check your connection and try again.'))
      }
    }
    pyWorker.addEventListener('message', onMessage)
    pyWorker.postMessage({ type: 'warmup' })
  })
  return pyReady
}

/** Posts one job to a worker and waits for its answer, or gives up after `limitMs`. */
function runInWorker(worker, payload, limitMs, onTimeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.removeEventListener('message', onMessage)
      onTimeout()
      resolve({ timedOut: true, results: [] })
    }, limitMs)
    function onMessage(event) {
      if (event.data?.type === 'ready') return
      clearTimeout(timer)
      worker.removeEventListener('message', onMessage)
      resolve(event.data)
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage(payload)
  })
}

/**
 * Runs the candidate's code against the problem's tests (visible only, or all for Submit) and
 * returns graded results. Never throws for a problem in the candidate's code; that is reported
 * as a compile error, a per-test error, or a time-out.
 */
export async function runCode({ language, code, problem, includeHidden = false, onStatus }) {
  const cases = prepareTests(problem, { includeHidden })
  const payload = { type: 'run', code, functionName: problem.functionName[language], cases: cases.map((c) => c.args) }

  let raw
  if (language === 'python') {
    if (!pyReady) onStatus?.('loading-python')
    await warmUpPython()
    onStatus?.('running')
    raw = await runInWorker(pyWorker, payload, PY_TIME_LIMIT_MS, resetPython)
  } else {
    onStatus?.('running')
    const worker = new Worker(new URL('./jsRunner.worker.js', import.meta.url), { type: 'module' })
    raw = await runInWorker(worker, payload, JS_TIME_LIMIT_MS, () => worker.terminate())
    worker.terminate()
  }

  if (raw.timedOut) {
    raw.results = cases.map(() => ({ error: 'Time limit exceeded. Check for an infinite loop or a slow algorithm.' }))
  }
  return gradeRun(problem, cases, raw)
}
