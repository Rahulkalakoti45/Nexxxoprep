/**
 * The coding round's interviewer when the AI one is unavailable (no Gemini key, or the server
 * can't be reached), plus a test-based evaluation and local attempt history. The scripted
 * interviewer only reacts to things it can know for certain: the stage, the test results and
 * whether the candidate has mentioned complexity.
 */

const COMPLEXITY_PATTERN = /\bO\s*\(|\blinear\b|\bconstant\b|\blog(arithmic)?\b|\bquadratic\b|n\s*log\s*n|\bn\^?2\b/i

const candidateTurns = (messages) => messages.filter((m) => m.role === 'candidate')

/** The run in the shape the AI interviewer endpoints expect. */
export function summarizeRun(graded) {
  if (!graded) return null
  return {
    passed: graded.passed,
    total: graded.total,
    hiddenPassed: graded.hiddenPassed,
    hiddenTotal: graded.hiddenTotal,
    compileError: graded.compileError,
    timedOut: graded.timedOut,
    failures: graded.results
      .filter((r) => !r.passed)
      .slice(0, 6)
      .map((r) => ({ label: r.label, input: r.input, expected: r.expected, actual: r.actual, error: r.error, hidden: r.hidden })),
  }
}

export function scriptedTurn({ problem, stage, event, messages = [], lastRun, hint }) {
  if (event === 'start') {
    return {
      reply: `Hi! Today we're doing ${problem.title}. Before you write any code, talk me through how you'd approach it, and roughly how fast it would be.`,
      readyToCode: false,
    }
  }

  if (event === 'hint') {
    return { reply: `Here's a nudge: ${hint}`, readyToCode: false }
  }

  if (event === 'submit' || stage === 'wrapup') {
    return {
      reply: "Thanks for walking me through it. To wrap up: what's the time and space complexity of your final solution, and what else would you test?",
      readyToCode: false,
    }
  }

  if (event === 'run' && lastRun) {
    if (lastRun.compileError) return { reply: `Looks like the code didn't run: "${lastRun.compileError}". Want to look at that first?`, readyToCode: false }
    if (lastRun.timedOut) {
      return { reply: 'That run hit the time limit. Is there a loop that might never end, or a slow step you could avoid?', readyToCode: false }
    }
    const firstFail = lastRun.failures?.[0]
    if (!firstFail) {
      return { reply: 'All the examples pass. Before you submit, which edge cases do you think the hidden tests check?', readyToCode: false }
    }
    if (firstFail.error) {
      return { reply: `For input ${firstFail.input}, it throws "${firstFail.error}". What do you think causes that?`, readyToCode: false }
    }
    return {
      reply: `For input ${firstFail.input} it returns ${firstFail.actual}, but the answer is ${firstFail.expected}. Can you trace through that case?`,
      readyToCode: false,
    }
  }

  // A message from the candidate.
  const said = candidateTurns(messages)
  const latest = said[said.length - 1]?.content || ''
  if (stage === 'approach') {
    if (COMPLEXITY_PATTERN.test(latest) || said.length >= 3) {
      return { reply: 'That sounds workable. Go ahead and code it, and run the examples whenever you like.', readyToCode: true }
    }
    if (said.length === 1) return { reply: 'Okay. What would the time and space complexity of that be?', readyToCode: false }
    return { reply: 'And what edge cases would you watch out for?', readyToCode: false }
  }
  return {
    reply: "I can only go by the problem statement here. Make a reasonable assumption, say it out loud, and keep going.",
    readyToCode: false,
  }
}

/**
 * Evaluation from the tests alone, used when the AI evaluation is unavailable. Only what can be
 * measured is scored; everything else is left as null instead of being guessed.
 */
export function localEvaluation({ problem, finalRun, messages = [], hintsUsed = 0 }) {
  const correctness = finalRun.total ? Math.round((finalRun.passed / finalRun.total) * 100) : 0
  const hintPenalty = Math.min(15, hintsUsed * 5)
  const failures = finalRun.failures || []
  const talkedComplexity = candidateTurns(messages).some((m) => COMPLEXITY_PATTERN.test(m.content))
  // The most recent Big-O the candidate actually wrote, e.g. "O(n) time and O(n) space".
  const statedLine = candidateTurns(messages)
    .map((m) => m.content)
    .reverse()
    .find((text) => /O\s*\([^)]+\)/.test(text))
  const stated = statedLine ? statedLine.match(/O\s*\([^)]+\)(\s*(time|space))?/gi).slice(0, 2).join(', ') : null

  const strengths = []
  if (correctness === 100) strengths.push('Passed every test, including the hidden and large ones.')
  else if (finalRun.passed > 0) strengths.push(`Passed ${finalRun.passed} of ${finalRun.total} tests.`)
  if (talkedComplexity) strengths.push('Talked about complexity out loud, which interviewers look for.')
  if (hintsUsed === 0 && correctness > 0) strengths.push('Solved it without hints.')

  const improvements = []
  if (finalRun.compileError) improvements.push(`The code didn't run: ${finalRun.compileError}`)
  if (finalRun.timedOut) improvements.push('A test hit the time limit. Look for a faster approach or a loop that never ends.')
  for (const f of failures.slice(0, 2)) {
    if (f.hidden) improvements.push(`Failed a hidden test${f.label ? `: ${f.label}` : ''}. Think about that kind of input.`)
  }
  if (!talkedComplexity) improvements.push('State your time and space complexity out loud. Interviewers expect it.')

  return {
    scores: { correctness, efficiency: null, codeQuality: null, communication: null },
    overall: Math.max(0, correctness - hintPenalty),
    verdict: correctness === 100 && hintsUsed === 0 ? 'strong' : correctness >= 50 ? 'okay' : 'weak',
    complexity: { stated, estimatedTime: null, estimatedSpace: null, isOptimal: null },
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    codeComments: [],
    optimalApproach: problem.hints[problem.hints.length - 1],
    hintPenalty,
    generatedBy: 'local',
  }
}

const HISTORY_KEY = 'nexoprep_coding_attempts_v1'

export function listCodingAttempts() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveCodingAttempt(attempt) {
  try {
    const list = [attempt, ...listCodingAttempts().filter((a) => a.id !== attempt.id)].slice(0, 30)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked: the result is still shown, just not kept.
  }
}

/** Replaces the whole device history (used after merging with the server). */
export function replaceCodingAttempts(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)))
  } catch {
    // Storage full or blocked: the merged list is still returned to the page.
  }
}

export function getCodingAttempt(id) {
  return listCodingAttempts().find((a) => a.id === id) || null
}
