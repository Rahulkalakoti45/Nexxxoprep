import type { FastifyInstance } from 'fastify'
import { AppError, createId } from '@nexoprep/shared'
import type { ConversationPublisher } from '../modules/realtime/conversation-publisher.js'
import type { ConversationMemory } from '../modules/conversation/memory.service.js'

interface ChatMessage {
  role: string
  content: string
}

interface ChatCompletionRequest {
  messages?: ChatMessage[]
  model?: string
  stream?: boolean
  user?: string
  user_id?: string
  elevenlabs_extra_body?: Record<string, unknown>
  dynamic_variables?: Record<string, unknown>
  metadata?: Record<string, unknown>
  conversation_id?: string
  sessionId?: string
  [key: string]: unknown
}

type SessionResolution = { sessionId: string | null; source: string | null }

function asNonEmptyString(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function resolveSessionId(body: ChatCompletionRequest): SessionResolution {
  const extra = (body.elevenlabs_extra_body || {}) as Record<string, unknown>
  const dynamic = (body.dynamic_variables || {}) as Record<string, unknown>
  const metadata = (body.metadata || {}) as Record<string, unknown>

  const checks: Array<[string, unknown]> = [
    ['body.user', body.user],
    ['body.user_id', body.user_id],
    ['body.sessionId', body.sessionId],
    ['body.conversation_id', body.conversation_id],
    ['elevenlabs_extra_body.sessionId', extra.sessionId],
    ['elevenlabs_extra_body.userId', extra.userId],
    ['elevenlabs_extra_body.user_id', extra.user_id],
    ['elevenlabs_extra_body.UUID', extra.UUID],
    ['elevenlabs_extra_body.uuid', extra.uuid],
    ['dynamic_variables.sessionId', dynamic.sessionId],
    ['dynamic_variables.userId', dynamic.userId],
    ['metadata.sessionId', metadata.sessionId],
  ]

  for (const [source, value] of checks) {
    const resolved = asNonEmptyString(value)
    if (resolved) return { sessionId: resolved, source }
  }

  return { sessionId: null, source: null }
}

function chunkToSse(content: string, id: string): string {
  const payload = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'nexoprep-gemini',
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  }
  return `data: ${JSON.stringify(payload)}\n\n`
}

function doneSse(): string {
  const payload = {
    id: createId('chat'),
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'nexoprep-gemini',
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  }
  return `data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`
}

function serializeRouteError(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return {
      message: error.message,
      stack: error.stack ?? null,
      status: error.statusCode,
      code: error.code,
      response: error.details ?? null,
      cause: error.cause ?? null,
    }
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? null,
      cause: error.cause ?? null,
    }
  }
  return { raw: error }
}

function getLastUserMessage(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role === 'user' && message.content?.trim()) return message.content.trim()
  }
  return null
}

/** Forensic: enumerate every field that might carry our backend session id */
function inspectSessionIdCandidates(body: unknown) {
  if (body === null || body === undefined) {
    return {
      bodyType: String(body),
      topLevelKeys: [],
      candidates: {},
    }
  }

  if (typeof body !== 'object') {
    return {
      bodyType: typeof body,
      topLevelKeys: [],
      candidates: { raw: body },
    }
  }

  const record = body as Record<string, unknown>
  const extra = (record.elevenlabs_extra_body || {}) as Record<string, unknown>
  const dynamic = (record.dynamic_variables || {}) as Record<string, unknown>
  const metadata = (record.metadata || {}) as Record<string, unknown>

  return {
    bodyType: 'object',
    topLevelKeys: Object.keys(record),
    candidates: {
      user: record.user ?? null,
      user_id: record.user_id ?? null,
      conversation_id: record.conversation_id ?? null,
      elevenlabs_extra_body: record.elevenlabs_extra_body ?? null,
      dynamic_variables: record.dynamic_variables ?? null,
      metadata: record.metadata ?? null,
      'elevenlabs_extra_body.sessionId': extra.sessionId ?? null,
      'elevenlabs_extra_body.UUID': extra.UUID ?? null,
      'elevenlabs_extra_body.uuid': extra.uuid ?? null,
      'elevenlabs_extra_body.userId': extra.userId ?? null,
      'elevenlabs_extra_body.user_id': extra.user_id ?? null,
      'dynamic_variables.sessionId': dynamic.sessionId ?? null,
      'dynamic_variables.userId': dynamic.userId ?? null,
      'metadata.sessionId': metadata.sessionId ?? null,
    },
  }
}

async function prepareMemoryForTurn(
  server: FastifyInstance,
  sessionId: string,
  messages: ChatMessage[],
): Promise<ConversationMemory | null> {
  let memory = await server.container.interviewEngine.ensureContextFromDatabase(sessionId)
  if (!memory) return null

  const lastAnswer = getLastUserMessage(messages)
  if (lastAnswer) {
    await server.container.interviewEngine.processCandidateAnswer(sessionId, lastAnswer)
    memory = await server.container.conversationMemory.get(sessionId)
  }

  if (memory) {
    server.container.interviewEngine.logContextBeforeGemini(sessionId, memory)
  }

  return memory
}

async function finalizeInterviewerTurn(server: FastifyInstance, sessionId: string, full: string): Promise<void> {
  const question = server.container.orchestrator.extractQuestion(full)
  console.log('[CUSTOM_LLM_RESPONSE_COMPLETE]', { sessionId, questionDetected: !!question })
  if (question) {
    await server.container.interviewEngine.recordInterviewerQuestion(sessionId, question)
  }
  await server.container.conversationMemory.appendTranscript(sessionId, {
    speaker: 'ai',
    content: full,
    isFinal: true,
  })
}

export async function registerCustomLlmRoutes(server: FastifyInstance): Promise<void> {
  const publisher = server.container.conversationPublisher as ConversationPublisher

  server.post('/v1/chat/completions', async (request, reply) => {
    console.log('[ELEVENLABS_RAW_REQUEST]', JSON.stringify(request.body, null, 2))
    console.log('[CUSTOM_LLM_REQUEST_RECEIVED]', {
      ts: new Date().toISOString(),
      method: request.method,
      url: request.url,
      contentType: request.headers['content-type'] ?? null,
      correlationId: request.id,
      bodyIsNull: request.body === null || request.body === undefined,
      bodyType: typeof request.body,
    })

    const secret = server.config.CUSTOM_LLM_SECRET
    console.log('[CUSTOM_LLM_VALIDATION]', {
      step: 'auth_check',
      hasCustomLlmSecret: Boolean(secret),
      authorizationHeaderPresent: Boolean(request.headers.authorization),
    })

    if (secret) {
      const auth = request.headers.authorization
      if (auth !== `Bearer ${secret}`) {
        console.log('[CUSTOM_LLM_VALIDATION]', {
          step: 'auth_failed',
          status: 401,
          reason: 'CUSTOM_LLM_SECRET mismatch or missing Authorization header',
        })
        return reply.status(401).send({ error: { message: 'Unauthorized custom LLM request' } })
      }
    }

    console.log('[CUSTOM_LLM_VALIDATION]', { step: 'auth_passed' })

    const body = (request.body ?? {}) as ChatCompletionRequest
    const sessionInspection = inspectSessionIdCandidates(body)

    console.log('[CUSTOM_LLM_SESSION_RESOLUTION]', {
      ts: new Date().toISOString(),
      inspection: sessionInspection,
      messagesCount: body.messages?.length ?? 0,
      stream: body.stream,
      model: body.model ?? null,
    })

    const { sessionId, source } = resolveSessionId(body)

    if (!sessionId) {
      console.log('[CUSTOM_LLM_VALIDATION]', {
        step: 'session_id_missing',
        status: 400,
        reason: 'No session id found in request body — Gemini will NOT run',
        sessionInspection,
      })
      return reply.status(400).send({ error: { message: 'Missing session id in request' } })
    }

    console.log('[SESSION_RESOLVED]', { sessionId, source })

    let memory = await server.container.conversationMemory.get(sessionId)
    if (!memory) {
      console.log('[CUSTOM_LLM_VALIDATION]', {
        step: 'memory_not_found',
        status: 404,
        sessionId,
        reason: 'Redis conversation memory missing for resolved session id',
      })
      return reply.status(404).send({ error: { message: 'Conversation memory not found for session' } })
    }

    console.log('[CUSTOM_LLM_VALIDATION]', {
      step: 'memory_found',
      sessionId,
      company: memory.company,
      role: memory.role,
      difficulty: memory.difficulty,
      hasCandidateProfile: Boolean(memory.candidateProfile),
    })

    await publisher.publish('AI_THINKING', { sessionId, userId: memory.userId })
    await server.container.conversationMemory.setLifecycle(sessionId, 'ai_processing')

    memory = (await prepareMemoryForTurn(server, sessionId, body.messages || [])) || memory

    const stream = body.stream !== false
    const completionId = createId('chatcmp')

    if (!stream) {
      console.log('[CUSTOM_LLM_GEMINI_START]', { sessionId, mode: 'buffered' })
      let full = ''
      for await (const token of server.container.orchestrator.streamResponse(memory, body.messages || [])) {
        full += token
      }
      console.log('[CUSTOM_LLM_GEMINI_COMPLETE]', { sessionId, mode: 'buffered', length: full.length })
      await finalizeInterviewerTurn(server, sessionId, full)
      await server.container.conversationMemory.setLifecycle(sessionId, 'ai_speaking')
      await publisher.publish('AI_SPEAKING', { sessionId, userId: memory.userId })

      return {
        id: completionId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'nexoprep-gemini',
        choices: [{ index: 0, message: { role: 'assistant', content: full }, finish_reason: 'stop' }],
      }
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    let full = ''
    console.log('[CUSTOM_LLM_GEMINI_START]', { sessionId, mode: 'stream' })
    try {
      for await (const token of server.container.orchestrator.streamResponse(memory, body.messages || [])) {
        full += token
        reply.raw.write(chunkToSse(token, completionId))
      }
      reply.raw.write(doneSse())
      console.log('[CUSTOM_LLM_GEMINI_COMPLETE]', { sessionId, mode: 'stream', length: full.length })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gemini stream failed'
      console.log('[GEMINI_ERROR_FULL]', serializeRouteError(error))
      console.log('[CUSTOM_LLM_GEMINI_COMPLETE]', {
        sessionId,
        mode: 'stream',
        error: message,
        partialLength: full.length,
      })
      await publisher.publish('CONVERSATION_ERROR', { sessionId, userId: memory.userId, message })
      reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`)
    } finally {
      if (full) {
        await finalizeInterviewerTurn(server, sessionId, full)
      }
      await server.container.conversationMemory.setLifecycle(sessionId, 'ai_speaking')
      await publisher.publish('AI_SPEAKING', { sessionId, userId: memory.userId })
      reply.raw.end()
    }
  })
}
