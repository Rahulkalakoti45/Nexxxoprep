export const DOMAIN_FLOW = ['resume', 'project', 'skill', 'coding', 'dsa', 'system-design', 'behavioral', 'hr', 'aptitude']

export function domainRank(domain) {
  const idx = DOMAIN_FLOW.indexOf(String(domain || '').toLowerCase())
  return idx === -1 ? DOMAIN_FLOW.length : idx
}

export function orderQuestions(questions = []) {
  return [...questions].sort((a, b) => {
    const byDomain = domainRank(a.domain) - domainRank(b.domain)
    if (byDomain !== 0) return byDomain
    return (a.estimatedTime || 0) - (b.estimatedTime || 0)
  })
}

export function mapRounds(rounds = [], questions = []) {
  return rounds.map((round, idx) => ({
    ...round,
    index: idx,
    questionIds: questions.filter((q) => q.round === round.label).map((q) => q.id),
  }))
}

