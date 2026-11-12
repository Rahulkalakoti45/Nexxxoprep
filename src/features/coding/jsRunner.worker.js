// Runs a candidate's JavaScript against test inputs, isolated from the page in a Web Worker.
// The page terminates this worker if it runs past the time limit (e.g. an infinite loop).

function format(value) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Values must survive postMessage; anything that can't be cloned is sent as its JSON form. */
function cloneable(value) {
  if (value === undefined) return undefined
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

self.onmessage = (event) => {
  const { code, functionName, cases } = event.data
  const logs = []
  const capture = (...args) => {
    if (logs.length < 200) logs.push(args.map(format).join(' '))
  }
  const sandboxConsole = { log: capture, info: capture, warn: capture, error: capture, debug: capture }

  let fn
  try {
    // functionName comes from the problem bank, never from the candidate.
    fn = new Function('console', `"use strict";\n${code}\n;return typeof ${functionName} === 'function' ? ${functionName} : undefined;`)(sandboxConsole)
  } catch (error) {
    self.postMessage({ compileError: `${error.name}: ${error.message}`, results: [], logs })
    return
  }
  if (typeof fn !== 'function') {
    self.postMessage({ compileError: `Define a function named ${functionName}.`, results: [], logs })
    return
  }

  const results = cases.map((args) => {
    const started = performance.now()
    try {
      const actual = fn(...args)
      return { actual: cloneable(actual), ms: Math.round((performance.now() - started) * 10) / 10 }
    } catch (error) {
      return { error: `${error?.name || 'Error'}: ${error?.message || String(error)}` }
    }
  })
  self.postMessage({ results, logs })
}
