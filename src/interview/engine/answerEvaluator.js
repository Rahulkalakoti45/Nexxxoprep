function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function evaluateInterviewAnswer(answer = '', question = {}) {
  const safeAnswer = typeof answer === 'string' ? answer : ''
  const words = safeAnswer.trim().split(/\s+/).filter(Boolean)
  const count = words.length
  const expected = Array.isArray(question.expectedConcepts) ? question.expectedConcepts : []
  const lower = safeAnswer.toLowerCase()
  const matched = expected.filter((concept) => lower.includes((concept || '').toLowerCase()))
  const structureSignals = ['first', 'second', 'finally', 'because', 'therefore']
  const structureHits = structureSignals.filter((term) => lower.includes(term)).length
  const score = clamp(Math.round(42 + count * 0.45 + matched.length * 9 + structureHits * 2), 20, 98)

  return {
    score,
    confidenceScore: clamp(Math.round(36 + matched.length * 10 + Math.min(25, count * 0.15)), 20, 98),
    clarityScore: clamp(Math.round(34 + Math.min(40, count * 0.45) + structureHits * 4), 20, 98),
    strengths: matched.length ? [`Matched concepts: ${matched.join(', ')}`] : ['Response addresses core prompt.'],
    weaknesses: matched.length ? [] : ['Missing key expected concepts.'],
    suggestions: matched.length ? ['Add one measurable example to strengthen response.'] : ['Cover expected concepts explicitly.'],
    meta: { wordCount: count, matchedConcepts: matched, structureHits },
  }
}
