import { getApiBaseUrl } from './api.js'

const MAX_RECONNECT_ATTEMPTS = 12
const BASE_RECONNECT_MS = 1000
const HEARTBEAT_MS = 25000

function wsBaseUrl() {
  const http = getApiBaseUrl()
  return http.replace(/^http/i, (match) => (match.toLowerCase() === 'https' ? 'wss' : 'ws'))
}

export class RealtimeClient {
  constructor({ userId, onEvent, onStatus }) {
    this.userId = userId
    this.onEvent = onEvent
    this.onStatus = onStatus
    this.socket = null
    this.reconnectAttempts = 0
    this.closedByUser = false
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.lastEventAt = Date.now()
  }

  connect() {
    if (!this.userId) return
    this.closedByUser = false
    this.openSocket()
  }

  openSocket() {
    const url = `${wsBaseUrl()}/ws/realtime?userId=${encodeURIComponent(this.userId)}`
    this.onStatus?.('connecting')
    this.socket = new WebSocket(url)

    this.socket.addEventListener('open', () => {
      this.reconnectAttempts = 0
      this.onStatus?.('connected')
      this.startHeartbeat()
    })

    this.socket.addEventListener('message', (event) => {
      this.lastEventAt = Date.now()
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type === 'pong') return
        this.onEvent?.(payload)
      } catch {
        // ignore malformed frames
      }
    })

    this.socket.addEventListener('close', () => {
      this.stopHeartbeat()
      this.onStatus?.('disconnected')
      if (!this.closedByUser) this.scheduleReconnect()
    })

    this.socket.addEventListener('error', () => {
      this.onStatus?.('error')
    })
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return
      this.socket.send(JSON.stringify({ type: 'ping', occurredAt: new Date().toISOString() }))
      if (Date.now() - this.lastEventAt > HEARTBEAT_MS * 3) {
        this.socket.close()
      }
    }, HEARTBEAT_MS)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.onStatus?.('failed')
      return
    }
    const delay = Math.min(30000, BASE_RECONNECT_MS * 2 ** this.reconnectAttempts)
    this.reconnectAttempts += 1
    this.onStatus?.('reconnecting')
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay)
  }

  disconnect() {
    this.closedByUser = true
    clearTimeout(this.reconnectTimer)
    this.stopHeartbeat()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.onStatus?.('closed')
  }

  send(event) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event))
    }
  }
}
