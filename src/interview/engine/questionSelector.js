import { ROLE_DOMAIN_PRIORITY } from '../data/roles/domainPriority.js'

function normalizeDomain(value) {
  return (value || '').toString().trim().toLowerCase()
}

export function sortQuestionsByRolePriority(questions, role = 'SDE') {
  const priorities = ROLE_DOMAIN_PRIORITY[role] || ROLE_DOMAIN_PRIORITY.SDE
  const indexMap = new Map(priorities.map((name, index) => [normalizeDomain(name), index]))

  return (Array.isArray(questions) ? questions : []).slice().sort((a, b) => {
    const pa = indexMap.get(normalizeDomain(a?.domain))
    const pb = indexMap.get(normalizeDomain(b?.domain))
    const safeA = Number.isInteger(pa) ? pa : 999
    const safeB = Number.isInteger(pb) ? pb : 999
    return safeA - safeB
  })
}

function dedupeQuestions(questions) {
  const seen = new Set()
  return questions.filter((question) => {
    const key = question?.id || `${question?.company}-${question?.round}-${question?.question}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function pickQuestionsForRound(questions, roundName, count, { role = 'SDE', company = 'General' } = {}) {
  const targetCount = Math.max(1, Number.isFinite(count) ? count : 1)
  const normalizedRound = (roundName || '').toLowerCase()
  const sorted = sortQuestionsByRolePriority(questions, role)
  const strictRound = sorted.filter((q) => (q.round || q.roundName || '').toLowerCase() === normalizedRound)
  const strictCompany = strictRound.filter((q) => q.company === company)
  const fallbackCompany = strictRound.filter((q) => q.company === 'General')
  const roleMatch = strictRound.filter((q) => q.role === role || q.role === 'General')
  const candidatePool = dedupeQuestions([...strictCompany, ...roleMatch, ...fallbackCompany, ...strictRound])
  return candidatePool.slice(0, targetCount)
}
