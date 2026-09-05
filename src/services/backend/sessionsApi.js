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
