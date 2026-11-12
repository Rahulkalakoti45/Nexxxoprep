import { api } from '../../lib/api.js'

export async function generateSessionReport(sessionId, payload) {
  const { report } = await api.post(`/api/reports/sessions/${encodeURIComponent(sessionId)}`, payload)
  return report
}

export async function getUserReports(userId, { limit = 25 } = {}) {
  const { reports } = await api.get(`/api/reports/users/${encodeURIComponent(userId)}?limit=${limit}`)
  return reports
}

/** Scores over time, weak spots with their trend, and what the next interview will revisit. */
export async function getUserProgress(userId) {
  const { progress } = await api.get(`/api/reports/users/${encodeURIComponent(userId)}/progress`)
  return progress
}
