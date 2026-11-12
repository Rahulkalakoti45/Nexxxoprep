// Runs a candidate's Python against test inputs using Pyodide (CPython compiled to WebAssembly).
// Pyodide is large, so it is downloaded once on first use and kept warm in this worker.

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
let pyodidePromise = null

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`).then(({ loadPyodide }) => loadPyodide({ indexURL: PYODIDE_URL }))
  }
  return pyodidePromise
}

/** The last line of a Python traceback, e.g. "TypeError: unsupported operand…". */
function pythonError(error) {
  const lines = String(error?.message || error).trim().split('\n').filter(Boolean)
  return lines[lines.length - 1] || 'Error'
}

self.onmessage = async (event) => {
  const { type, code, functionName, cases } = event.data
  if (type === 'warmup') {
    try {
      await getPyodide()
      self.postMessage({ type: 'ready' })
    } catch (error) {
      self.postMessage({ type: 'load-error', error: String(error?.message || error) })
    }
    return
  }

  const pyodide = await getPyodide()
  const logs = []
  const capture = (line) => {
    if (logs.length < 200) logs.push(line)
  }
  pyodide.setStdout({ batched: capture })
  pyodide.setStderr({ batched: capture })

  // A fresh namespace per run, so earlier attempts can't leak into this one.
  const namespace = pyodide.globals.get('dict')()
  try {
    pyodide.runPython(code, { globals: namespace })
  } catch (error) {
    namespace.destroy()
    self.postMessage({ type: 'result', compileError: pythonError(error), results: [], logs })
    return
  }
  if (!namespace.has(functionName)) {
    namespace.destroy()
    self.postMessage({ type: 'result', compileError: `Define a function named ${functionName}.`, results: [], logs })
    return
  }

  const results = cases.map((args) => {
    namespace.set('__nexo_args', JSON.stringify(args))
    const started = performance.now()
    try {
      const out = pyodide.runPython(`import json as __nexo_json\n__nexo_json.dumps(${functionName}(*__nexo_json.loads(__nexo_args)))`, { globals: namespace })
      return { actual: JSON.parse(out), ms: Math.round((performance.now() - started) * 10) / 10 }
    } catch (error) {
      return { error: pythonError(error) }
    }
  })
  namespace.destroy()
  self.postMessage({ type: 'result', results, logs })
}
