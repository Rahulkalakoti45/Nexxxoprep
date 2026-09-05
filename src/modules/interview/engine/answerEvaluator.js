const STRUCTURE_CUES = ['situation', 'task', 'action', 'result', 'because', 'tradeoff', 'therefore']

function countMatches(text, expected = []) {
  const normalized = String(text || '').toLowerCase()
  return expected.filter((kw) => normalized.includes(String(kw).toLowerCase())).length
}

export function evaluateAnswer(answer = '', question) {
  const expectedConcepts = question?.expectedConcepts || []
  const words = answer.trim() ? answer.trim().split(/\s+/) : []
  const wordCount = words.length
  const matches = countMatches(answer, expectedConcepts)
  const structure = STRUCTURE_CUES.filter((c) => answer.toLowerCase().includes(c)).length

  const keywordScore = expectedConcepts.length ? Math.min(45, (matches / expectedConcepts.length) * 45) : 22
  const lengthScore = Math.min(30, (wordCount / 90) * 30)
  const clarityScore = Math.min(25, (structure / 3) * 25)
  const score = Math.round(keywordScore + lengthScore + clarityScore)

  return {
    score,
    confidence: score >= 78 ? 'high' : score >= 48 ? 'medium' : 'low',
    clarity: clarityScore >= 18 ? 'clear' : clarityScore >= 10 ? 'moderate' : 'unclear',
    strengths: [
      matches > 0 ? `Covered ${matches} expected concepts.` : 'Try including key domain concepts.',
      wordCount >= 60 ? 'Good depth.' : 'Add one more concrete detail or example.',
    ],
    weaknesses: [
      matches < 2 ? 'Concept coverage is low.' : 'Concept coverage is reasonable.',
      structure < 2 ? 'Structure can be clearer (STAR / steps / tradeoffs).' : 'Structure is mostly clear.',
    ],
    suggestions: ['Use a 3-part structure (context → action → impact).', 'Mention tradeoffs explicitly.', 'Add 1 metric or outcome.'],
    meta: { wordCount, matches },
  }
}

