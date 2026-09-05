import { api } from '../../lib/api.js'

export async function generateSessionReport(sessionId, payload) {
  const { report } = await api.post(`/api/reports/sessions/${encodeURIComponent(sessionId)}`, payload)
  return report
}

export async function getUserReports(userId, { limit = 25 } = {}) {
  const { reports } = await api.get(`/api/reports/users/${encodeURIComponent(userId)}?limit=${limit}`)
  return reports
}
