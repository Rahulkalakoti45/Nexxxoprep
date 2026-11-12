/**
 * Pure test-harness logic shared by the runner and the results screen: turning a problem's test
 * list into concrete cases, comparing outputs, and summarising a run without leaking hidden
 * inputs.
 */

/** Concrete test cases for a problem: `build` tests are expanded into plain args. */
export function prepareTests(problem, { includeHidden = true } = {}) {
  return problem.tests
    .map((test, index) => ({
      index,
      hidden: Boolean(test.hidden),
      label: test.label || null,
      args: test.build ? test.build() : test.args,
      expected: test.expected,
    }))
    .filter((test) => includeHidden || !test.hidden)
}

/** JSON round-trip: -0 becomes 0, tuples become arrays, undefined becomes null. */
function normalize(value) {
  if (value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function sortedTopLevel(value) {
  if (!Array.isArray(value)) return value
  return value.map((item) => JSON.stringify(item)).sort()
}

/** Whether `actual` matches `expected` under the problem's comparison rule. */
export function outputsMatch(actual, expected, compare = 'exact') {
  const a = normalize(actual)
  const e = normalize(expected)
  if (compare === 'unordered') return JSON.stringify(sortedTopLevel(a)) === JSON.stringify(sortedTopLevel(e))
  return JSON.stringify(a) === JSON.stringify(e)
}

/** A short, readable form of a value for display (long arrays are trimmed). */
export function preview(value, max = 120) {
  let text
  try {
    text = JSON.stringify(normalize(value))
  } catch {
    text = String(value)
  }
  if (text === undefined) text = 'undefined'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * Combines the runner's raw outputs with the test cases into per-test results and totals.
 * Hidden tests keep their pass/fail and label but never their inputs or expected outputs.
 */
export function gradeRun(problem, cases, raw) {
  const results = cases.map((test, i) => {
    const out = raw.results?.[i] || { error: 'Not run' }
    const passed = !out.error && outputsMatch(out.actual, test.expected, problem.compare)
    return {
      index: test.index,
      hidden: test.hidden,
      label: test.label,
      passed,
      error: out.error || null,
      ms: out.ms ?? null,
      input: test.hidden ? null : test.args.map((arg) => preview(arg)).join(', '),
      expected: test.hidden ? null : preview(test.expected),
      actual: test.hidden || out.error ? null : preview(out.actual),
    }
  })
  const visible = results.filter((r) => !r.hidden)
  const hidden = results.filter((r) => r.hidden)
  return {
    results,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    visiblePassed: visible.filter((r) => r.passed).length,
    visibleTotal: visible.length,
    hiddenPassed: hidden.filter((r) => r.passed).length,
    hiddenTotal: hidden.length,
    compileError: raw.compileError || null,
    timedOut: Boolean(raw.timedOut),
    logs: (raw.logs || []).slice(0, 50),
  }
}
