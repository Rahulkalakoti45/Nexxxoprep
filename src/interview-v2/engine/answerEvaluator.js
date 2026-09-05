const STRUCTURE_HINTS = ['first', 'second', 'because', 'therefore', 'result']

function countKeywordMatches(answer, expectedConcepts = []) {
  const normalized = answer.toLowerCase()
  return expectedConcepts.filter((concept) => normalized.includes(String(concept).toLowerCase())).length
}

export function evaluateAnswer(answer = '', question) {
  const expectedConcepts = question?.expectedConcepts || []
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0
  const keywordMatches = countKeywordMatches(answer, expectedConcepts)
  const structureSignals = STRUCTURE_HINTS.filter((signal) => answer.toLowerCase().includes(signal)).length

  const keywordScore = expectedConcepts.length
    ? Math.min(40, (keywordMatches / expectedConcepts.length) * 40)
    : 20
  const lengthScore = Math.min(30, (wordCount / 90) * 30)
  const clarityScore = Math.min(30, (structureSignals / 3) * 30)
  const score = Math.round(keywordScore + lengthScore + clarityScore)

  return {
    score,
    confidence: score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low',
    clarity: clarityScore >= 20 ? 'clear' : clarityScore >= 12 ? 'moderate' : 'unclear',
    strengths: [
      keywordMatches > 0 ? `Matched ${keywordMatches} expected concepts.` : 'Opportunity to include expected concepts.',
      wordCount > 50 ? 'Answer has sufficient depth.' : 'Answer can include more depth.',
    ],
    weaknesses: [
      keywordMatches < 2 ? 'Low concept coverage for the target domain.' : 'Concept coverage is reasonable.',
      structureSignals < 2 ? 'Structure can be improved with clearer sequencing.' : 'Structure is mostly good.',
    ],
    suggestions: [
      'Use STAR or problem-solution-impact structure.',
      'Add one measurable impact detail.',
      'Mention tradeoffs explicitly.',
    ],
  }
}
