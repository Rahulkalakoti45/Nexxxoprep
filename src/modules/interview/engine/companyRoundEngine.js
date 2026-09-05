import amazon from '../data/companies/amazon'
import google from '../data/companies/google'
import microsoft from '../data/companies/microsoft'
import tcs from '../data/companies/tcs'
import infosys from '../data/companies/infosys'
import wipro from '../data/companies/wipro'

const COMPANY_DATA = { amazon, google, microsoft, tcs, infosys, wipro }

export function getCompanyProfile(company) {
  const key = String(company || '').trim().toLowerCase()
  return COMPANY_DATA[key] || null
}

export function getCompanyRounds(company) {
  const profile = getCompanyProfile(company)
  if (profile?.rounds?.length) return profile.rounds
  return [
    { id: 'fallback-resume', label: 'Resume + Projects', domain: 'resume' },
    { id: 'fallback-tech', label: 'Technical + Problem Solving', domain: 'dsa' },
    { id: 'fallback-design', label: 'System Design', domain: 'system-design' },
    { id: 'fallback-beh', label: 'Behavioral', domain: 'behavioral' },
  ]
}

