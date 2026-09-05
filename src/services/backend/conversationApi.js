import { api } from '../../lib/api.js'

export async function startConversation(sessionId, payload) {
  return api.post(`/api/conversation/sessions/${encodeURIComponent(sessionId)}/start`, payload)
}

export async function getConversationToken(sessionId, options = {}) {
  return api.get(`/api/conversation/sessions/${encodeURIComponent(sessionId)}/token`, options)
}

export async function ingestTranscriptChunk(sessionId, payload) {
  return api.post(`/api/conversation/sessions/${encodeURIComponent(sessionId)}/transcript-chunk`, payload)
}

export async function updateConversationLifecycle(sessionId, lifecycle) {
  return api.patch(`/api/conversation/sessions/${encodeURIComponent(sessionId)}/lifecycle`, { lifecycle })
}

export async function endConversation(sessionId, payload) {
  return api.post(`/api/conversation/sessions/${encodeURIComponent(sessionId)}/end`, payload)
}

export async function getConversationMemory(sessionId) {
  return api.get(`/api/conversation/sessions/${encodeURIComponent(sessionId)}/memory`)
}

export async function getOrchestratorDebug(sessionId) {
  return api.get(`/api/conversation/sessions/${encodeURIComponent(sessionId)}/orchestrator-debug`)
}

export async function getElevenLabsAgentAudit() {
  return api.get('/api/conversation/elevenlabs-agent-audit')
}

export async function sendConversationHeartbeat(sessionId, payload) {
  return api.post(`/api/conversation/sessions/${encodeURIComponent(sessionId)}/heartbeat`, payload)
}
