import { api } from '../../lib/api.js'

export async function getUserAnalytics(userId) {
  const { snapshot } = await api.get(`/api/analytics/users/${encodeURIComponent(userId)}`)
  return snapshot
}

export async function recordBehaviorMetric(sessionId, payload) {
  const { metric } = await api.post(
    `/api/analytics/sessions/${encodeURIComponent(sessionId)}/behavior-metrics`,
    payload,
  )
  return metric
}

export async function recordEmotionState(sessionId, payload) {
  const { state } = await api.post(
    `/api/analytics/sessions/${encodeURIComponent(sessionId)}/emotion-states`,
    payload,
  )
  return state
}
