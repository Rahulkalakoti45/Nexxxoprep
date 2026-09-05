import { COMPANY_ROUND_FLOWS } from '../data/companies/companyFlows'

export function getCompanyRoundFlow(company) {
  const key = String(company || '').trim().toLowerCase()
  return COMPANY_ROUND_FLOWS[key] || []
}

export function getSafeFallbackRounds() {
  return [
    { id: 'fallback-resume', label: 'Resume Discussion', domain: 'resume' },
    { id: 'fallback-technical', label: 'Technical Round', domain: 'technical' },
    { id: 'fallback-problem-solving', label: 'Problem Solving', domain: 'problem-solving' },
    { id: 'fallback-behavioral', label: 'Behavioral Round', domain: 'behavioral' },
  ]
}
