/** Authoritative conversation lifecycle states */
export const LIFECYCLE = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  LISTENING: 'listening',
  AI_SPEAKING: 'ai_speaking',
  AI_PROCESSING: 'ai_processing',
  RECONNECTING: 'reconnecting',
  CONNECTION_FAILED: 'connection_failed',
  ENDED: 'ended',
}

/** Transport / WebRTC connection states */
export const CONNECTION = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
  ENDED: 'ended',
}

const VALID_TRANSITIONS = {
  [LIFECYCLE.IDLE]: [LIFECYCLE.CONNECTING, LIFECYCLE.ENDED],
  [LIFECYCLE.CONNECTING]: [LIFECYCLE.CONNECTED, LIFECYCLE.LISTENING, LIFECYCLE.RECONNECTING, LIFECYCLE.CONNECTION_FAILED, LIFECYCLE.ENDED],
  [LIFECYCLE.CONNECTED]: [LIFECYCLE.LISTENING, LIFECYCLE.AI_SPEAKING, LIFECYCLE.AI_PROCESSING, LIFECYCLE.RECONNECTING, LIFECYCLE.ENDED],
  [LIFECYCLE.LISTENING]: [LIFECYCLE.AI_SPEAKING, LIFECYCLE.AI_PROCESSING, LIFECYCLE.CONNECTED, LIFECYCLE.RECONNECTING, LIFECYCLE.ENDED],
  [LIFECYCLE.AI_SPEAKING]: [LIFECYCLE.LISTENING, LIFECYCLE.CONNECTED, LIFECYCLE.RECONNECTING, LIFECYCLE.ENDED],
  [LIFECYCLE.AI_PROCESSING]: [LIFECYCLE.AI_SPEAKING, LIFECYCLE.LISTENING, LIFECYCLE.RECONNECTING, LIFECYCLE.ENDED],
  [LIFECYCLE.RECONNECTING]: [LIFECYCLE.CONNECTED, LIFECYCLE.LISTENING, LIFECYCLE.CONNECTION_FAILED, LIFECYCLE.ENDED],
  [LIFECYCLE.CONNECTION_FAILED]: [LIFECYCLE.CONNECTING, LIFECYCLE.RECONNECTING, LIFECYCLE.ENDED],
  [LIFECYCLE.ENDED]: [],
}

export function canTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed) return true
  return allowed.includes(to)
}

/** Enforce invariants: reconnecting/failed never coexists with transportReady */
export function syncConversationState(partial) {
  const next = { ...partial }
  const lifecycle = next.lifecycle
  const connection = next.connectionStatus

  const isReconnecting =
    lifecycle === LIFECYCLE.RECONNECTING || connection === CONNECTION.RECONNECTING
  const isFailed =
    lifecycle === LIFECYCLE.CONNECTION_FAILED || connection === CONNECTION.FAILED
  const isConnecting =
    lifecycle === LIFECYCLE.CONNECTING || connection === CONNECTION.CONNECTING

  if (isReconnecting || isFailed || isConnecting) {
    next.transportReady = false
    next.conversationConnected = false
  }

  if (connection === CONNECTION.CONNECTED && !isReconnecting && !isFailed) {
    next.transportReady = true
    next.conversationConnected = true
  }

  if (lifecycle === LIFECYCLE.ENDED || connection === CONNECTION.ENDED) {
    next.transportReady = false
    next.conversationConnected = false
    next.sessionActive = false
  }

  return next
}

export function mapElevenLabsMode(mode) {
  if (mode === 'speaking') return LIFECYCLE.AI_SPEAKING
  if (mode === 'listening') return LIFECYCLE.LISTENING
  return LIFECYCLE.CONNECTED
}

export function logTransition(event, payload) {
  console.info(`[conversation:${event}]`, {
    ts: new Date().toISOString(),
    ...payload,
  })
}
