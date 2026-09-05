import { DOMAIN_FLOW_ORDER } from '../data/companies/companyFlows'

export function getDomainRank(domain) {
  const normalizedDomain = domain === 'system-design' ? 'technical' : domain
  const rank = DOMAIN_FLOW_ORDER.indexOf(normalizedDomain)
  return rank === -1 ? DOMAIN_FLOW_ORDER.length : rank
}

export function orderQuestionsByFlow(questions = []) {
  return [...questions].sort((a, b) => {
    const domainSort = getDomainRank(a.domain) - getDomainRank(b.domain)
    if (domainSort !== 0) return domainSort
    return a.estimatedTime - b.estimatedTime
  })
}

export function mapQuestionsToRounds(rounds = [], questions = []) {
  return rounds.map((round, roundIndex) => {
    const roundQuestions = questions.filter((question) => question.round === round.label)
    return {
      ...round,
      index: roundIndex,
      questionIds: roundQuestions.map((question) => question.id),
    }
  })
}
