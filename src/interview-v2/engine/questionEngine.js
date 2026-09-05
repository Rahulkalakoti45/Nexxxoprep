import { APTITUDE_QUESTIONS } from '../data/aptitude/questions'
import { BEHAVIORAL_QUESTIONS } from '../data/behavioral/questions'
import { COMPANY_QUESTIONS } from '../data/companies/questions'
import { TECHNICAL_QUESTIONS } from '../data/technical/questions'
import { orderQuestionsByFlow } from '../utils/questionHelpers'
import { isValidQuestion } from '../utils/validators'

function normalizeCompany(company) {
  return String(company || '').trim().toLowerCase()
}

export function getFallbackQuestions({ company = 'generic', role = 'Software Engineer', rounds = [] } = {}) {
  const genericPool = [...TECHNICAL_QUESTIONS, ...APTITUDE_QUESTIONS, ...BEHAVIORAL_QUESTIONS].filter(isValidQuestion)
  const selected = rounds
    .map((round, index) => {
      const generic = genericPool[index % genericPool.length]
      return {
        ...generic,
        id: `fallback-${index + 1}-${generic.id}`,
        company,
        role,
        round: round.label,
        domain: round.domain,
      }
    })
    .filter(isValidQuestion)

  return orderQuestionsByFlow(selected)
}

export function getCompanyQuestions({ company, role, rounds }) {
  const key = normalizeCompany(company)
  const roundLabels = new Set((rounds || []).map((round) => round.label))

  const companyQuestions = COMPANY_QUESTIONS.filter((question) => {
    const companyMatch = normalizeCompany(question.company) === key
    const roundMatch = roundLabels.has(question.round)
    return companyMatch && roundMatch
  }).filter(isValidQuestion)

  if (companyQuestions.length === 0) {
    return getFallbackQuestions({ company: key || 'generic', role, rounds })
  }

  return orderQuestionsByFlow(companyQuestions)
}
