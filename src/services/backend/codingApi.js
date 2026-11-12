import { api } from '../../lib/api.js'

// No retries: if the AI interviewer is unavailable the page falls back to the built-in one
// straight away rather than leaving the candidate waiting.
export async function codingTurn(payload) {
  const { turn } = await api.post('/api/coding/turn', payload, { retries: 0 })
  return turn
}

export async function evaluateCoding(payload) {
  const { evaluation } = await api.post('/api/coding/evaluate', payload, { retries: 0 })
  return evaluation
}

export async function saveCodingAttemptRemote(userId, attempt) {
  const { attempt: saved } = await api.post('/api/coding/attempts', { userId, attempt }, { retries: 1 })
  return saved
}

export async function listCodingAttemptsRemote(userId, { limit = 30 } = {}) {
  const { attempts } = await api.get(`/api/coding/users/${encodeURIComponent(userId)}/attempts?limit=${limit}`, { retries: 0 })
  return attempts
}

export async function getCodingAttemptRemote(userId, attemptId) {
  const { attempt } = await api.get(`/api/coding/users/${encodeURIComponent(userId)}/attempts/${encodeURIComponent(attemptId)}`, { retries: 0 })
  return attempt
}
