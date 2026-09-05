const DOMAIN_KEYWORDS = {
  DSA: ['time complexity', 'space complexity', 'hashmap', 'two pointers', 'dp', 'graph', 'tree', 'heap'],
  'System Design': ['scale', 'latency', 'throughput', 'cache', 'database', 'replication', 'partition', 'trade-off'],
  HR: ['situation', 'task', 'action', 'result', 'collaborate', 'conflict', 'feedback', 'leadership'],
  Backend: ['api', 'database', 'index', 'transaction', 'queue', 'retry', 'timeout', 'idempotent'],
  Resume: ['project', 'impact', 'metric', 'optimized', 'built', 'led', 'implemented'],
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function analyzeAnswer(answerText, questionType, domain = 'General') {
  const cleanText = answerText.trim()
  const words = cleanText.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  const qualityKeywords = [
    'scalable',
    'trade-off',
    'impact',
    'optimize',
    'design',
    'latency',
    'reliable',
    'testing',
    'stakeholder',
    'metric',
    'result',
  ]

  const foundKeywords = qualityKeywords.filter((keyword) =>
    cleanText.toLowerCase().includes(keyword.toLowerCase()),
  )

  const structureBoost = /\b(first|second|finally|because|therefore|example)\b/i.test(cleanText)
  const domainTerms = (DOMAIN_KEYWORDS[domain] || []).filter((term) => cleanText.toLowerCase().includes(term))
  const domainBoost = Math.min(10, domainTerms.length * 3)

  const baseScore = 52 + wordCount * 0.38 + foundKeywords.length * 4 + (structureBoost ? 5 : 0) + domainBoost
  const score = clamp(Math.round(baseScore), 30, 96)

  const clarityScore = clamp(Math.round(45 + (structureBoost ? 15 : 0) + Math.min(20, wordCount * 0.22)), 30, 95)
  const confidenceSignals = /\b(i believe|i think|maybe|not sure|guess)\b/i.test(cleanText) ? -8 : 6
  const confidenceScore = clamp(
    Math.round(50 + Math.min(18, foundKeywords.length * 3) + Math.min(10, domainTerms.length * 2) + confidenceSignals),
    30,
    95,
  )

  const strengths = []
  if (wordCount >= 45) strengths.push('Answer has strong depth and sufficient context.')
  if (foundKeywords.length >= 2) strengths.push(`Uses relevant terms: ${foundKeywords.slice(0, 3).join(', ')}.`)
  if (domainTerms.length >= 1) strengths.push(`Includes ${domain}-specific signals.`)
  if (structureBoost) strengths.push('Response shows structured communication flow.')
  if (strengths.length === 0) strengths.push('Core intent is clear and addresses the question directly.')

  const weaknesses = []
  if (wordCount < 25) weaknesses.push('Response is brief; key details and reasoning are missing.')
  if (foundKeywords.length === 0)
    weaknesses.push('Lacks specific technical or behavioral signals expected in strong interviews.')
  if (domain !== 'General' && domainTerms.length === 0)
    weaknesses.push(`Add 1-2 ${domain} keywords to make the answer feel grounded.`)
  if (!/\b(example|instance|project|situation)\b/i.test(cleanText))
    weaknesses.push('Could be more credible with a concrete example.')
  if (weaknesses.length === 0) weaknesses.push('Some points can still be made more concise and prioritized.')

  const suggestions = []
  suggestions.push(`For ${questionType}, use a 3-part structure: context, action, outcome.`)
  suggestions.push('Add one measurable result to make your answer more persuasive.')
  if (wordCount < 40) suggestions.push('Aim for 45-90 words to balance detail and clarity.')
  if (foundKeywords.length < 2)
    suggestions.push('Include domain keywords that reflect system thinking or ownership.')
  if (domain !== 'General') suggestions.push(`Use 1 example that matches ${domain} expectations.`)

  return {
    score,
    clarityScore,
    confidenceScore,
    strengths,
    weaknesses,
    suggestions,
    meta: {
      wordCount,
      foundKeywords,
      domainTerms,
    },
  }
}

export function aggregateInterviewFeedback(answerEntries) {
  if (!answerEntries.length) {
    return {
      overallScore: 0,
      strengthsSummary: ['No answers submitted.'],
      weaknessSummary: ['No data available to analyze.'],
    }
  }

  const overallScore = Math.round(
    answerEntries.reduce((sum, answer) => sum + answer.feedback.score, 0) / answerEntries.length,
  )

  const strengthsSummary = [...new Set(answerEntries.flatMap((item) => item.feedback.strengths))].slice(0, 4)
  const weaknessSummary = [...new Set(answerEntries.flatMap((item) => item.feedback.weaknesses))].slice(0, 4)

  return {
    overallScore,
    strengthsSummary,
    weaknessSummary,
  }
}
