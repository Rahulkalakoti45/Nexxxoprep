import { api } from '../../lib/api.js'

export async function createSession(payload) {
  const { session } = await api.post('/api/sessions', payload)
  return session
}

export async function getSession(sessionId) {
  const { session } = await api.get(`/api/sessions/${encodeURIComponent(sessionId)}`)
  return session
}

export async function getSessionState(sessionId) {
  const { state } = await api.get(`/api/sessions/${encodeURIComponent(sessionId)}/state`)
  return state
}

export async function updateSessionState(sessionId, payload) {
  const { state } = await api.patch(`/api/sessions/${encodeURIComponent(sessionId)}/state`, payload)
  return state
}

export async function appendTranscript(sessionId, payload) {
  const { transcript } = await api.post(`/api/sessions/${encodeURIComponent(sessionId)}/transcripts`, payload)
  return transcript
}

export async function getBehaviorStatus(sessionId, options) {
  const { status } = await api.get(`/api/sessions/${encodeURIComponent(sessionId)}/behavior/status`, options)
  return status
}

/** Stores the in-browser behavior analysis for a session (scores only, never video). */
export function postBehaviorSummary(sessionId, summary, { final = false, keepalive = false } = {}) {
  return api.post(
    `/api/sessions/${encodeURIComponent(sessionId)}/behavior/summary`,
    { final, summary },
    { keepalive, retries: keepalive ? 0 : 1 },
  )
}
