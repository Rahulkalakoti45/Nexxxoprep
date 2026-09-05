import { api } from '../../lib/api.js'

export async function analyzeResume(userId, payload) {
  const { analysis } = await api.post(`/api/resume/users/${encodeURIComponent(userId)}/analyze`, payload)
  return analysis
}

export async function getLatestResumeAnalysis(userId) {
  const { analysis } = await api.get(`/api/resume/users/${encodeURIComponent(userId)}/latest`)
  return analysis
}
