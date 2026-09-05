import { useCallback, useEffect, useRef, useState } from 'react'
import { Conversation } from '@elevenlabs/client'
import {
  endConversation,
  getConversationToken,
  getElevenLabsAgentAudit,
  ingestTranscriptChunk,
  sendConversationHeartbeat,
  startConversation,
  updateConversationLifecycle,
} from '../../../services/backend/conversationApi.js'
import { conversationCleanupManager } from '../conversationCleanupManager.js'
import { categorizeConversationError, ERROR_CODES } from '../conversationErrors.js'
import {
  CONNECTION,
  LIFECYCLE,
  logTransition,
  mapElevenLabsMode,
  syncConversationState,
} from '../conversationStateMachine.js'

const FINAL_DEBOUNCE_MS = 900
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAYS_MS = [2000, 5000, 10000]
const RECONNECT_TIMEOUT_MS = 20000
const HEARTBEAT_INTERVAL_MS = 15000
const TOKEN_DEBOUNCE_MS = 400

const tokenCache = new Map()
const tokenInFlight = new Map()
const activeSessionLock = { sessionId: null }

function invalidateTokenCache(sessionId) {
  tokenCache.delete(sessionId)
  tokenInFlight.delete(sessionId)
}

/** Map raw disconnect reason to diagnostic reconnect trigger category */
function normalizeReconnectTrigger(reason) {
  const r = String(reason || 'unknown')
  if (r === 'agent') return 'agent'
  if (r.includes('visibility')) return 'visibility'
  if (r === 'audio-track-ended' || r.includes('audio-track')) return 'audio-track-ended'
  if (r === 'mic-track-ended' || r.includes('mic-track')) return 'mic-track-ended'
  if (r === 'webrtc-disconnect' || r.includes('network') || r.includes('ice')) return 'network'
  if (r.includes('transport') || r.includes('reconnect') || r.startsWith('disconnect:')) return 'transport'
  return r
}

function formatElevenLabsEvent(name, payload) {
  try {
    return `${name} @ ${new Date().toISOString()} — ${JSON.stringify(payload)}`
  } catch {
    return `${name} @ ${new Date().toISOString()}`
  }
}

export function useConversation({ session, user, resume, onError }) {
  const [lifecycle, setLifecycle] = useState(LIFECYCLE.IDLE)
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION.IDLE)
  const [currentSpeaker, setCurrentSpeaker] = useState('idle')
  const [entries, setEntries] = useState([])
  const [partialText, setPartialText] = useState('')
  const [muted, setMuted] = useState(false)
  const [ready, setReady] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [sessionActive, setSessionActive] = useState(false)
  const [conversationConnected, setConversationConnected] = useState(false)
  const [transportReady, setTransportReady] = useState(false)
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(null)
  const [micState, setMicState] = useState('unknown')
  const [errorCode, setErrorCode] = useState(null)
  const [debugInfo, setDebugInfo] = useState({})
  const [lastDisconnectReason, setLastDisconnectReason] = useState(null)
  const [lastReconnectTrigger, setLastReconnectTrigger] = useState(null)
  const [lastElevenLabsEvent, setLastElevenLabsEvent] = useState(null)
  const [agentDisconnectContext, setAgentDisconnectContext] = useState(null)

  const conversationRef = useRef(null)
  const activeSessionRef = useRef(null)
  const cleanupRef = useRef(false)
  const reconnectTimerRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const heartbeatTimerRef = useRef(null)
  const audioHealthTimerRef = useRef(null)
  const micStreamRef = useRef(null)
  const tokenAbortRef = useRef(null)
  const isConnectingRef = useRef(false)
  const activeConversationRef = useRef(false)
  const sessionInitializedRef = useRef(false)
  const transportGenerationRef = useRef(0)
  const endedByUserRef = useRef(false)
  const reconnectAttemptRef = useRef(0)
  const tokenDebounceRef = useRef(null)
  const sequenceRef = useRef(0)
  const partialTimerRef = useRef(null)
  const lastPartialRef = useRef({ speaker: null, content: '' })
  const lifecycleRef = useRef(LIFECYCLE.IDLE)
  const connectionRef = useRef(CONNECTION.IDLE)
  const transportReadyRef = useRef(false)
  const tokenFetchedAtRef = useRef(null)
  const visibilityListenersRef = useRef([])
  const handleTransportDisconnectRef = useRef(null)
  const currentSpeakerRef = useRef('idle')

  const backendSessionId = session?.backendSessionId

  const recordElevenLabsEvent = useCallback((eventName, payload = {}) => {
    const formatted = formatElevenLabsEvent(eventName, payload)
    setLastElevenLabsEvent(formatted)
    console.info('[ELEVENLABS_EVENT]', { event: eventName, sessionId: backendSessionId, ...payload })
    updateDebugRef.current?.({ lastElevenLabsEvent: formatted })
  }, [backendSessionId])

  const updateDebugRef = useRef(null)

  const applyState = useCallback((partial) => {
    const synced = syncConversationState(partial)
    if (synced.lifecycle !== undefined) {
      lifecycleRef.current = synced.lifecycle
      setLifecycle(synced.lifecycle)
    }
    if (synced.connectionStatus !== undefined) {
      connectionRef.current = synced.connectionStatus
      setConnectionStatus(synced.connectionStatus)
    }
    if (synced.transportReady !== undefined) {
      transportReadyRef.current = synced.transportReady
      setTransportReady(synced.transportReady)
    }
    if (synced.conversationConnected !== undefined) setConversationConnected(synced.conversationConnected)
    if (synced.sessionActive !== undefined) setSessionActive(synced.sessionActive)
    if (synced.isReconnecting !== undefined) setIsReconnecting(synced.isReconnecting)
    if (synced.isConnecting !== undefined) setIsConnecting(synced.isConnecting)
    if (synced.reconnectAttempt !== undefined) setReconnectAttempt(synced.reconnectAttempt)
    return synced
  }, [])

  const updateDebug = useCallback((extra = {}) => {
    if (!import.meta.env.DEV) return
    setDebugInfo({
      sessionId: backendSessionId || '—',
      lifecycle: lifecycleRef.current,
      connection: connectionRef.current,
      transportReady: transportReadyRef.current ? 'yes' : 'no',
      reconnectAttempts: reconnectAttemptRef.current,
      lastHeartbeat: lastHeartbeatAt || '—',
      micState,
      tokenAgeSec: tokenFetchedAtRef.current
        ? Math.round((Date.now() - tokenFetchedAtRef.current) / 1000)
        : '—',
      transportGeneration: transportGenerationRef.current,
      sessionInitialized: sessionInitializedRef.current ? 'yes' : 'no',
      activeConversation: activeConversationRef.current ? 'yes' : 'no',
      lastDisconnectReason: lastDisconnectReason || '—',
      lastReconnectTrigger: lastReconnectTrigger || '—',
      ...extra,
    })
  }, [backendSessionId, lastDisconnectReason, lastHeartbeatAt, lastReconnectTrigger, micState])

  updateDebugRef.current = updateDebug

  const reportError = useCallback(
    (error, fallbackCode = ERROR_CODES.INTERNAL) => {
      const categorized = categorizeConversationError(error)
      setErrorCode(categorized.code || fallbackCode)
      onError?.(categorized.message)
      logTransition('error', { sessionId: backendSessionId, code: categorized.code, message: categorized.message })
    },
    [backendSessionId, onError],
  )

  const clearReconnectTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  const stopAudioHealthCheck = useCallback(() => {
    if (audioHealthTimerRef.current) {
      clearInterval(audioHealthTimerRef.current)
      audioHealthTimerRef.current = null
    }
  }, [])

  const pushFinalEntry = useCallback((speaker, content) => {
    if (!content?.trim()) return
    setEntries((prev) => [...prev, { speaker, content: content.trim(), at: new Date().toISOString() }])
    setPartialText('')
  }, [])

  const persistChunk = useCallback(
    async (speaker, content, isFinal) => {
      if (!backendSessionId || !user?.id || !content?.trim()) return
      const mappedSpeaker = speaker === 'user' ? 'candidate' : 'ai'
      try {
        await ingestTranscriptChunk(backendSessionId, {
          userId: user.id,
          speaker: mappedSpeaker,
          content: content.trim(),
          isFinal,
          sequence: isFinal ? sequenceRef.current++ : undefined,
        })
      } catch (error) {
        reportError(error, ERROR_CODES.INTERNAL)
      }
    },
    [backendSessionId, reportError, user?.id],
  )

  const schedulePartialFinal = useCallback(
    (speaker, content) => {
      lastPartialRef.current = { speaker, content }
      setPartialText(content)
      if (partialTimerRef.current) clearTimeout(partialTimerRef.current)
      partialTimerRef.current = setTimeout(() => {
        const latest = lastPartialRef.current
        pushFinalEntry(latest.speaker, latest.content)
        void persistChunk(latest.speaker, latest.content, true)
      }, FINAL_DEBOUNCE_MS)
    },
    [persistChunk, pushFinalEntry],
  )

  const stopMicStream = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
    }
    setMicState('stopped')
  }, [])

  const destroyTransport = useCallback(
    async (reason) => {
      logTransition('destroyTransport', { sessionId: backendSessionId, reason })
      transportGenerationRef.current += 1
      activeConversationRef.current = false
      clearReconnectTimers()
      stopHeartbeat()
      stopAudioHealthCheck()
      visibilityListenersRef.current.forEach(({ target, event, handler }) => {
        target?.removeEventListener?.(event, handler)
      })
      visibilityListenersRef.current = []
      await conversationCleanupManager.cleanup(reason)
      conversationRef.current = null
      applyState({
        transportReady: false,
        conversationConnected: false,
      })
    },
    [applyState, backendSessionId, clearReconnectTimers, stopAudioHealthCheck, stopHeartbeat],
  )

  const cleanupConversation = useCallback(
    async (reason, notifyBackend = false) => {
      if (cleanupRef.current) return
      cleanupRef.current = true
      logTransition('cleanup', { sessionId: backendSessionId, reason, notifyBackend })
      if (partialTimerRef.current) clearTimeout(partialTimerRef.current)
      if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current)
      if (tokenAbortRef.current) tokenAbortRef.current.abort()
      clearReconnectTimers()
      stopHeartbeat()
      stopAudioHealthCheck()
      stopMicStream()
      await destroyTransport(reason)
      if (notifyBackend && backendSessionId && user?.id) {
        try {
          await endConversation(backendSessionId, { userId: user.id })
        } catch {
          // ignore cleanup failure
        }
      }
      activeSessionRef.current = null
      activeSessionLock.sessionId = null
      sessionInitializedRef.current = false
      isConnectingRef.current = false
      activeConversationRef.current = false
      invalidateTokenCache(backendSessionId)
      applyState({
        isConnecting: false,
        isReconnecting: false,
        sessionActive: false,
        transportReady: false,
        conversationConnected: false,
      })
      setReady(false)
      cleanupRef.current = false
    },
    [
      applyState,
      backendSessionId,
      clearReconnectTimers,
      destroyTransport,
      stopAudioHealthCheck,
      stopHeartbeat,
      stopMicStream,
      user?.id,
    ],
  )

  const fetchConversationToken = useCallback(
    async (forceRefresh = false) => {
      if (!backendSessionId) return null
      if (forceRefresh) invalidateTokenCache(backendSessionId)
      if (tokenCache.has(backendSessionId)) return tokenCache.get(backendSessionId)
      if (tokenInFlight.has(backendSessionId)) return tokenInFlight.get(backendSessionId)

      if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current)
      await new Promise((resolve) => {
        tokenDebounceRef.current = setTimeout(resolve, TOKEN_DEBOUNCE_MS)
      })

      const controller = new AbortController()
      tokenAbortRef.current = controller
      logTransition('token:request', { sessionId: backendSessionId })
      const promise = getConversationToken(backendSessionId, { signal: controller.signal })
        .then((res) => {
          tokenCache.set(backendSessionId, res.conversationToken)
          tokenFetchedAtRef.current = Date.now()
          logTransition('token:response', { sessionId: backendSessionId })
          return res.conversationToken
        })
        .finally(() => tokenInFlight.delete(backendSessionId))
      tokenInFlight.set(backendSessionId, promise)
      return promise
    },
    [backendSessionId],
  )

  const startAudioHealthCheck = useCallback(() => {
    stopAudioHealthCheck()
    audioHealthTimerRef.current = setInterval(() => {
      const stream = micStreamRef.current
      if (!stream || endedByUserRef.current) return
      const track = stream.getAudioTracks()[0]
      if (!track) {
        setMicState('missing')
        logTransition('audioHealth:missing', { sessionId: backendSessionId })
        return
      }
      if (track.readyState === 'ended') {
        setMicState('ended')
        logTransition('audioHealth:ended', { sessionId: backendSessionId })
        if (lifecycleRef.current !== LIFECYCLE.ENDED && lifecycleRef.current !== LIFECYCLE.CONNECTION_FAILED) {
          void handleTransportDisconnectRef.current?.('audio-track-ended')
        }
        return
      }
      setMicState(track.muted ? 'muted' : track.enabled ? 'active' : 'disabled')
    }, 5000)
  }, [backendSessionId, stopAudioHealthCheck])

  const startHeartbeat = useCallback(() => {
    stopHeartbeat()
    heartbeatTimerRef.current = setInterval(() => {
      if (!backendSessionId || !user?.id || endedByUserRef.current) return
      const health = transportReadyRef.current ? 'healthy' : 'degraded'
      const now = new Date().toISOString()
      setLastHeartbeatAt(now)
      void sendConversationHeartbeat(backendSessionId, {
        userId: user.id,
        connectionHealth: health,
        transportReady: transportReadyRef.current,
        lifecycle: lifecycleRef.current,
      }).catch(() => {
        // heartbeat failure marks degraded locally
        setLastHeartbeatAt(`${now} (failed)`)
      })
      updateDebug({ lastHeartbeat: now })
    }, HEARTBEAT_INTERVAL_MS)
  }, [backendSessionId, stopHeartbeat, updateDebug, user?.id])

  const failReconnect = useCallback(
    (code, message) => {
      clearReconnectTimers()
      isConnectingRef.current = false
      activeConversationRef.current = false
      applyState({
        lifecycle: LIFECYCLE.CONNECTION_FAILED,
        connectionStatus: CONNECTION.FAILED,
        isReconnecting: false,
        isConnecting: false,
        transportReady: false,
        conversationConnected: false,
      })
      setErrorCode(code)
      onError?.(message)
      logTransition('reconnect:failed', { sessionId: backendSessionId, code, attempts: reconnectAttemptRef.current })
      updateDebug()
    },
    [applyState, backendSessionId, clearReconnectTimers, onError, updateDebug],
  )

  const beginReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    reconnectTimeoutRef.current = setTimeout(() => {
      if (lifecycleRef.current === LIFECYCLE.RECONNECTING || connectionRef.current === CONNECTION.RECONNECTING) {
        failReconnect(
          ERROR_CODES.RECONNECT_TIMEOUT,
          categorizeConversationError(new Error('Reconnection timed out')).message,
        )
      }
    }, RECONNECT_TIMEOUT_MS)
  }, [failReconnect])

  const connectTransport = useCallback(
    async ({ isReconnect = false, forceToken = false } = {}) => {
      if (!backendSessionId || !user?.id) return false

      const generation = ++transportGenerationRef.current
      logTransition(isReconnect ? 'onReconnect' : 'onConnect:attempt', {
        sessionId: backendSessionId,
        generation,
        isReconnect,
      })

      applyState({
        connectionStatus: isReconnect ? CONNECTION.RECONNECTING : CONNECTION.CONNECTING,
        lifecycle: isReconnect ? LIFECYCLE.RECONNECTING : LIFECYCLE.CONNECTING,
        isReconnecting: isReconnect,
        isConnecting: !isReconnect,
        transportReady: false,
        conversationConnected: false,
      })

      try {
        let conversationToken = null
        if (import.meta.env.VITE_ELEVENLABS_AGENT_ID) {
          conversationToken = forceToken ? await fetchConversationToken(true) : await fetchConversationToken(false)
        } else {
          conversationToken = await fetchConversationToken(forceToken)
        }

        const options = {
          connectionType: 'webrtc',
          userId: backendSessionId,
        }

        const sessionPropagationPayload = {
          userId: backendSessionId,
          customLlmExtraBody: {
            sessionId: backendSessionId,
            userId: backendSessionId,
          },
          dynamicVariables: {
            sessionId: backendSessionId,
            userId: backendSessionId,
          },
        }

        if (import.meta.env.VITE_ELEVENLABS_AGENT_ID) {
          options.agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID
          if (conversationToken) options.conversationToken = conversationToken
        } else if (conversationToken) {
          options.conversationToken = conversationToken
        } else {
          throw new Error('No conversation token available')
        }

        let elevenLabsAudit = null
        try {
          const auditRes = await getElevenLabsAgentAudit()
          elevenLabsAudit = auditRes?.audit ?? null
        } catch (auditError) {
          console.warn('[ELEVENLABS_AGENT_CONFIG]', {
            warning: 'failed to fetch agent audit',
            message: auditError instanceof Error ? auditError.message : String(auditError),
          })
        }

        const startSessionPayload = {
          ...options,
          ...sessionPropagationPayload,
        }

        console.info('[ELEVENLABS_SESSION_START]', {
          backendSessionId,
          agentId: startSessionPayload.agentId ?? null,
          hasConversationToken: Boolean(startSessionPayload.conversationToken),
          connectionType: startSessionPayload.connectionType,
        })
        console.info('[ELEVENLABS_AGENT_CONFIG]', elevenLabsAudit)
        if (elevenLabsAudit?.customLlmUrl) {
          console.info('[CUSTOM_LLM_URL]', {
            customLlmUrl: elevenLabsAudit.customLlmUrl,
            apiType: elevenLabsAudit.customLlmApiType,
            customLlmEnabled: elevenLabsAudit.customLlmEnabled,
            customLlmExtraBodyOverrideEnabled: elevenLabsAudit.customLlmExtraBodyOverrideEnabled,
            backupLlmPreference: elevenLabsAudit.backupLlmPreference,
            backupLlmOrder: elevenLabsAudit.backupLlmOrder,
          })
        }
        if (elevenLabsAudit && !elevenLabsAudit.customLlmExtraBodyOverrideEnabled) {
          console.error('[ELEVENLABS_AGENT_CONFIG]', {
            error: 'custom_llm_extra_body override disabled — Custom LLM will NOT be called when customLlmExtraBody is sent',
          })
        }
        console.info('[SESSION_PROPAGATION]', {
          backendSessionId,
          payloadSent: sessionPropagationPayload,
        })

        const conversation = await Conversation.startSession({
          ...startSessionPayload,
          onConnect: (connectDetails) => {
            if (generation !== transportGenerationRef.current) return
            recordElevenLabsEvent('onConnect', {
              connection: CONNECTION.CONNECTED,
              conversationId: connectDetails?.conversationId ?? null,
            })
            console.info('[ELEVENLABS_SESSION_START]', {
              phase: 'connected',
              backendSessionId,
              elevenLabsConversationId: connectDetails?.conversationId ?? null,
            })
            logTransition('onConnect', {
              sessionId: backendSessionId,
              connection: CONNECTION.CONNECTED,
              transport: 'ready',
              conversationId: connectDetails?.conversationId ?? null,
            })
            clearReconnectTimers()
            reconnectAttemptRef.current = 0
            activeConversationRef.current = true
            applyState({
              lifecycle: LIFECYCLE.CONNECTED,
              connectionStatus: CONNECTION.CONNECTED,
              isReconnecting: false,
              isConnecting: false,
              transportReady: true,
              conversationConnected: true,
              reconnectAttempt: 0,
            })
            setErrorCode(null)
            setReady(true)
            startHeartbeat()
            startAudioHealthCheck()
            void updateConversationLifecycle(backendSessionId, 'listening')
            updateDebug()
          },
          onDisconnect: (details) => {
            if (generation !== transportGenerationRef.current) return
            const reason = details?.reason || 'unknown'
            const disconnectDiagnostics = {
              reason,
              lifecycle: lifecycleRef.current,
              connectionState: connectionRef.current,
              transportReady: transportReadyRef.current,
              activeConversation: activeConversationRef.current,
              currentSpeaker: currentSpeakerRef.current,
              context: details?.context,
              closeCode: details?.closeCode,
              closeReason: details?.closeReason,
              message: details?.message,
              ts: new Date().toISOString(),
            }
            console.warn('[onDisconnect:diagnostics]', disconnectDiagnostics)
            setLastDisconnectReason(reason)
            recordElevenLabsEvent('onDisconnect', disconnectDiagnostics)

            logTransition('onDisconnect', {
              sessionId: backendSessionId,
              reason,
              connection: CONNECTION.DISCONNECTED,
              transport: 'down',
              ...disconnectDiagnostics,
            })

            if (reason === 'agent') {
              console.warn('[AGENT_DISCONNECT]', 'Agent intentionally closed conversation', details)
              setAgentDisconnectContext(
                details?.context ? JSON.stringify(details.context) : 'no context',
              )
              return
            }

            applyState({
              connectionStatus: CONNECTION.DISCONNECTED,
              transportReady: false,
              conversationConnected: false,
            })
            if (!endedByUserRef.current) {
              void handleTransportDisconnectRef.current?.(reason || 'webrtc-disconnect')
            }
          },
          onError: (message, context = {}) => {
            if (generation !== transportGenerationRef.current) return
            const errorType = context?.errorType ?? null
            if (
              errorType === 'custom_llm_error' ||
              errorType === 'override_error' ||
              errorType === 'llm_error'
            ) {
              console.error('[ELEVENLABS_LLM_ROUTING_ERROR]', {
                errorType,
                message,
                code: context?.code ?? null,
                debugMessage: context?.debugMessage ?? null,
                details: context?.details ?? null,
              })
            }
            recordElevenLabsEvent('onError', { message, errorType, ...context })
            logTransition('onError', { sessionId: backendSessionId, message, errorType })
            reportError(new Error(message || 'Conversation error'), ERROR_CODES.TRANSPORT_FAILED)
          },
          onConversationMetadata: (metadata) => {
            if (generation !== transportGenerationRef.current) return
            console.info('[ELEVENLABS_SESSION_START]', {
              phase: 'initiation_metadata',
              backendSessionId,
              metadata,
            })
            recordElevenLabsEvent('onConversationMetadata', metadata)
          },
          onStatusChange: ({ status }) => {
            if (generation !== transportGenerationRef.current) return
            recordElevenLabsEvent('onStatusChange', { status })
            if (lifecycleRef.current === LIFECYCLE.RECONNECTING) return
            if (status === 'connected') {
              applyState({ connectionStatus: CONNECTION.CONNECTED, transportReady: true, conversationConnected: true })
            } else if (status === 'disconnected') {
              applyState({ connectionStatus: CONNECTION.DISCONNECTED, transportReady: false, conversationConnected: false })
            }
            logTransition('onStatusChange', { sessionId: backendSessionId, status })
          },
          onModeChange: ({ mode }) => {
            if (generation !== transportGenerationRef.current) return
            recordElevenLabsEvent('onModeChange', { mode })
            if (lifecycleRef.current === LIFECYCLE.RECONNECTING || lifecycleRef.current === LIFECYCLE.CONNECTION_FAILED) {
              return
            }
            const mapped = mapElevenLabsMode(mode)
            applyState({ lifecycle: mapped })
            const speaker = mode === 'speaking' ? 'ai' : mode === 'listening' ? 'user' : 'idle'
            currentSpeakerRef.current = speaker
            setCurrentSpeaker(speaker)
            void updateConversationLifecycle(backendSessionId, mapped)
          },
          onAgentToolResponse: (toolResponse) => {
            if (generation !== transportGenerationRef.current) return
            const toolName = toolResponse?.tool_name || 'unknown'
            recordElevenLabsEvent('onAgentToolResponse', { toolName, toolResponse })
            if (toolName === 'end_call') {
              console.warn('[AGENT_TOOL:end_call]', 'ElevenLabs agent invoked end_call tool', toolResponse)
            }
          },
          onDebug: (debugPayload) => {
            if (generation !== transportGenerationRef.current) return
            if (debugPayload?.type === 'conversation_initiation_client_data') {
              console.info('[ELEVENLABS_SESSION_START]', {
                phase: 'client_data_sent',
                backendSessionId,
                initiationClientData: debugPayload.message ?? debugPayload,
              })
            }
            recordElevenLabsEvent('onDebug', debugPayload)
          },
          onMessage: (message) => {
            if (generation !== transportGenerationRef.current) return
            const source = message.role === 'user' ? 'user' : 'ai'
            const text = message.message || ''
            if (!text) return
            schedulePartialFinal(source, text)
            void persistChunk(source, text, true)
          },
          onAgentChatResponsePart: (part) => {
            if (generation !== transportGenerationRef.current) return
            if (part?.text) schedulePartialFinal('ai', part.text)
          },
        })

        if (generation !== transportGenerationRef.current) {
          try {
            await conversation.endSession()
          } catch {
            // superseded transport
          }
          return false
        }

        conversationRef.current = conversation
        activeConversationRef.current = true
        activeSessionRef.current = backendSessionId
        activeSessionLock.sessionId = backendSessionId
        conversationCleanupManager.setActive({
          sessionId: backendSessionId,
          conversation,
          micProbeStream: micStreamRef.current,
        })
        logTransition('onConversationStarted', { sessionId: backendSessionId, generation })
        updateDebug()
        return true
      } catch (error) {
        if (generation !== transportGenerationRef.current) return false
        reportError(error, ERROR_CODES.TRANSPORT_FAILED)
        applyState({
          transportReady: false,
          conversationConnected: false,
        })
        return false
      }
    },
    [
      applyState,
      backendSessionId,
      clearReconnectTimers,
      fetchConversationToken,
      persistChunk,
      reportError,
      schedulePartialFinal,
      startAudioHealthCheck,
      startHeartbeat,
      updateDebug,
      recordElevenLabsEvent,
      user?.id,
    ],
  )

  const scheduleReconnect = useCallback(
    (reason) => {
      if (endedByUserRef.current) return
      if (lifecycleRef.current === LIFECYCLE.ENDED) return

      const trigger = normalizeReconnectTrigger(reason)
      console.warn('[RECONNECT_SCHEDULED]', {
        trigger,
        rawReason: reason,
        sessionId: backendSessionId,
        lifecycle: lifecycleRef.current,
        connectionState: connectionRef.current,
        transportReady: transportReadyRef.current,
        ts: new Date().toISOString(),
      })
      setLastReconnectTrigger(trigger)

      if (trigger === 'agent') {
        console.warn('[RECONNECT_BLOCKED]', 'Skipping reconnect — agent intentionally closed conversation')
        return
      }

      const attempt = reconnectAttemptRef.current + 1
      reconnectAttemptRef.current = attempt
      setReconnectAttempt(attempt)

      if (attempt > MAX_RECONNECT_ATTEMPTS) {
        failReconnect(
          ERROR_CODES.RECONNECT_EXHAUSTED,
          categorizeConversationError(new Error('Connection lost')).message,
        )
        return
      }

      applyState({
        lifecycle: LIFECYCLE.RECONNECTING,
        connectionStatus: CONNECTION.RECONNECTING,
        isReconnecting: true,
        isConnecting: false,
        transportReady: false,
        conversationConnected: false,
        reconnectAttempt: attempt,
      })
      beginReconnectTimeout()

      const delay = RECONNECT_DELAYS_MS[attempt - 1] ?? RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1]
      logTransition('onReconnect:scheduled', {
        sessionId: backendSessionId,
        attempt,
        delayMs: delay,
        reason,
        trigger,
      })

      reconnectTimerRef.current = setTimeout(() => {
        void (async () => {
          if (isConnectingRef.current) return
          isConnectingRef.current = true
          invalidateTokenCache(backendSessionId)
          await destroyTransport(`reconnect-attempt-${attempt}`)
          const ok = await connectTransport({ isReconnect: true, forceToken: true })
          isConnectingRef.current = false
          if (ok) return
          if (attempt >= MAX_RECONNECT_ATTEMPTS) {
            failReconnect(
              ERROR_CODES.RECONNECT_EXHAUSTED,
              categorizeConversationError(new Error('Connection lost')).message,
            )
          } else {
            scheduleReconnect('transport-connect-failed')
          }
        })()
      }, delay)
    },
    [applyState, backendSessionId, beginReconnectTimeout, connectTransport, destroyTransport, failReconnect],
  )

  handleTransportDisconnectRef.current = async (reason) => {
    if (endedByUserRef.current) return
    if (reason === 'agent' || normalizeReconnectTrigger(reason) === 'agent') {
      console.warn('[RECONNECT_BLOCKED]', 'handleTransportDisconnect skipped for agent disconnect', { reason })
      return
    }
    if (lifecycleRef.current === LIFECYCLE.RECONNECTING && isConnectingRef.current) return

    const trigger = normalizeReconnectTrigger(reason)
    console.warn('[TRANSPORT_DISCONNECT_HANDLER]', {
      trigger,
      rawReason: reason,
      sessionId: backendSessionId,
      lifecycle: lifecycleRef.current,
      connectionState: connectionRef.current,
      transportReady: transportReadyRef.current,
      activeConversation: activeConversationRef.current,
      currentSpeaker: currentSpeakerRef.current,
    })

    logTransition('onDisconnect:handler', { sessionId: backendSessionId, reason, trigger })
    applyState({
      lifecycle: LIFECYCLE.RECONNECTING,
      connectionStatus: CONNECTION.RECONNECTING,
      isReconnecting: true,
      transportReady: false,
      conversationConnected: false,
    })

    await destroyTransport(`disconnect:${reason}`)
    scheduleReconnect(reason)
  }

  const initializeBackendSession = useCallback(async () => {
    if (sessionInitializedRef.current) {
      logTransition('start:skipped-backend', { sessionId: backendSessionId, reason: 'already-initialized' })
      return null
    }
    logTransition('start:backend', { sessionId: backendSessionId })
    const startRes = await startConversation(backendSessionId, {
      userId: user.id,
      role: session.role,
      company: session.company,
      difficulty: session.difficulty,
      candidateName: user?.name,
      resumeText: resume?.rawText || '',
      resumeSummary: resume?.rawText
        ? resume.rawText.replace(/\s+/g, ' ').trim().slice(0, 400)
        : undefined,
      skills: resume?.skills || resume?.analysis?.skills || [],
      projects: resume?.projects || resume?.analysis?.projects || [],
      experience: resume?.experience || resume?.analysis?.experience || [],
    })
    sessionInitializedRef.current = true
    if (startRes?.conversationToken) {
      tokenCache.set(backendSessionId, startRes.conversationToken)
      tokenFetchedAtRef.current = Date.now()
    }
    return startRes
  }, [backendSessionId, resume, session, user?.id])

  const ensureMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const track = stream.getAudioTracks()[0]
      setMicState(track?.readyState === 'live' ? 'active' : 'unknown')
      track?.addEventListener('ended', () => {
        setMicState('ended')
        logTransition('audioHealth:track-ended', { sessionId: backendSessionId })
        if (!endedByUserRef.current) {
          void handleTransportDisconnectRef.current?.('mic-track-ended')
        }
      })
      navigator.mediaDevices?.addEventListener?.('devicechange', () => {
        updateDebug({ micState: 'device-change' })
      })
      return true
    } catch (error) {
      reportError(error, ERROR_CODES.MICROPHONE_UNAVAILABLE)
      return false
    }
  }, [backendSessionId, reportError, updateDebug])

  const start = useCallback(async () => {
    if (!backendSessionId || !user?.id || !session) return
    if (isConnectingRef.current) {
      logTransition('start:rejected', { sessionId: backendSessionId, reason: 'already-connecting' })
      return
    }
    if (activeConversationRef.current && activeSessionRef.current === backendSessionId && transportReadyRef.current) {
      logTransition('start:rejected', { sessionId: backendSessionId, reason: 'already-active' })
      return
    }

    if (activeSessionLock.sessionId && activeSessionLock.sessionId !== backendSessionId) {
      await cleanupConversation('switch-session', true)
    }

    isConnectingRef.current = true
    endedByUserRef.current = false
    reconnectAttemptRef.current = 0
    applyState({
      isConnecting: true,
      sessionActive: true,
      connectionStatus: CONNECTION.CONNECTING,
      lifecycle: LIFECYCLE.CONNECTING,
      transportReady: false,
      conversationConnected: false,
      reconnectAttempt: 0,
      isReconnecting: false,
    })

    try {
      await initializeBackendSession()
      const micOk = await ensureMicrophone()
      if (!micOk) {
        applyState({ sessionActive: false, isConnecting: false })
        return
      }

      if (conversationRef.current) {
        await destroyTransport('start-pre-clean')
      }

      const ok = await connectTransport({ isReconnect: false, forceToken: false })
      if (!ok && reconnectAttemptRef.current === 0) {
        applyState({
          lifecycle: LIFECYCLE.CONNECTION_FAILED,
          connectionStatus: CONNECTION.FAILED,
          sessionActive: false,
        })
      }
    } catch (error) {
      reportError(error, ERROR_CODES.INTERNAL)
      applyState({
        connectionStatus: CONNECTION.FAILED,
        lifecycle: LIFECYCLE.CONNECTION_FAILED,
        sessionActive: false,
        transportReady: false,
      })
    } finally {
      isConnectingRef.current = false
      applyState({ isConnecting: false })
      updateDebug()
    }
  }, [
    applyState,
    backendSessionId,
    cleanupConversation,
    connectTransport,
    destroyTransport,
    ensureMicrophone,
    initializeBackendSession,
    reportError,
    session,
    updateDebug,
    user?.id,
  ])

  const end = useCallback(async () => {
    endedByUserRef.current = true
    logTransition('onConversationEnded', { sessionId: backendSessionId, reason: 'user' })
    await cleanupConversation('end', true)
    applyState({
      lifecycle: LIFECYCLE.ENDED,
      connectionStatus: CONNECTION.ENDED,
      isReconnecting: false,
    })
  }, [applyState, backendSessionId, cleanupConversation])

  const reconnect = useCallback(async () => {
    if (isConnectingRef.current) return
    logTransition('reconnect:manual', { sessionId: backendSessionId })
    reconnectAttemptRef.current = 0
    setReconnectAttempt(0)
    setErrorCode(null)
    clearReconnectTimers()
    invalidateTokenCache(backendSessionId)
    await destroyTransport('manual-reconnect')
    isConnectingRef.current = true
    applyState({
      isReconnecting: true,
      lifecycle: LIFECYCLE.RECONNECTING,
      connectionStatus: CONNECTION.RECONNECTING,
      transportReady: false,
      conversationConnected: false,
    })
    beginReconnectTimeout()
    const ok = await connectTransport({ isReconnect: true, forceToken: true })
    isConnectingRef.current = false
    if (!ok) {
      scheduleReconnect('manual-reconnect-failed')
    }
  }, [
    applyState,
    backendSessionId,
    beginReconnectTimeout,
    clearReconnectTimers,
    connectTransport,
    destroyTransport,
    scheduleReconnect,
  ])

  const toggleMute = useCallback(async () => {
    const conversation = conversationRef.current
    if (!conversation) return
    try {
      conversation.setMicMuted(!muted)
      setMuted((prev) => !prev)
      setMicState(!muted ? 'muted' : 'active')
    } catch {
      setMuted((prev) => !prev)
    }
  }, [muted])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const conv = conversationRef.current
      if (!conv || endedByUserRef.current) return
      const isOpen = typeof conv.isOpen === 'function' ? conv.isOpen() : transportReadyRef.current
      logTransition('visibility:visible', {
        sessionId: backendSessionId,
        transportOpen: isOpen,
        lifecycle: lifecycleRef.current,
      })
      if (!isOpen && lifecycleRef.current !== LIFECYCLE.RECONNECTING && lifecycleRef.current !== LIFECYCLE.CONNECTION_FAILED) {
        void handleTransportDisconnectRef.current?.('visibility-transport-down')
      }
    }

    const onFocus = () => logTransition('focus', { sessionId: backendSessionId })
    const onBlur = () => logTransition('blur', { sessionId: backendSessionId })

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    visibilityListenersRef.current = [
      { target: document, event: 'visibilitychange', handler: onVisibilityChange },
      { target: window, event: 'focus', handler: onFocus },
      { target: window, event: 'blur', handler: onBlur },
    ]

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [backendSessionId])

  useEffect(() => {
    updateDebug()
  }, [
    lifecycle,
    connectionStatus,
    transportReady,
    reconnectAttempt,
    lastHeartbeatAt,
    micState,
    updateDebug,
  ])

  useEffect(() => {
    const onBeforeUnload = () => {
      endedByUserRef.current = true
      stopMicStream()
      if (backendSessionId && user?.id) {
        const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/api/conversation/sessions/${encodeURIComponent(backendSessionId)}/end`
        void fetch(url, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_API_KEY || '',
          },
          body: JSON.stringify({ userId: user.id }),
        })
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      void cleanupConversation('unmount', true)
    }
  }, [backendSessionId, cleanupConversation, stopMicStream, user?.id])

  return {
    lifecycle,
    connectionStatus,
    currentSpeaker,
    entries,
    partialText,
    muted,
    ready,
    isConnecting,
    isReconnecting,
    reconnectAttempt,
    sessionActive,
    conversationConnected,
    transportReady,
    lastHeartbeatAt,
    micState,
    errorCode,
    connectionFailed: lifecycle === LIFECYCLE.CONNECTION_FAILED,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    debugInfo,
    diagnostics: {
      lastDisconnectReason,
      lastReconnectTrigger,
      lastElevenLabsEvent,
      agentDisconnectContext,
    },
    start,
    end,
    reconnect,
    toggleMute,
  }
}
