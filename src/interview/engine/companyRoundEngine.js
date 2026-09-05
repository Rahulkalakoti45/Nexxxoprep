import { COMPANY_ROUND_PROFILES } from '../data/companies/roundProfiles.js'

export function getCompanyRounds(company = 'General') {
  const requested = typeof company === 'string' ? company.trim() : ''
  if (requested && COMPANY_ROUND_PROFILES[requested]) return COMPANY_ROUND_PROFILES[requested]
  return COMPANY_ROUND_PROFILES.General
}
