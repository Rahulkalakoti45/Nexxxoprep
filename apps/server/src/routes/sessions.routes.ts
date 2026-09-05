import { get as httpGet } from 'node:http'
import type { FastifyInstance } from 'fastify'
import {
  appendTranscriptSchema,
  createSessionSchema,
  sessionIdParamSchema,
  updateSessionStateSchema,
  ValidationError,
} from '@nexoprep/shared'
import type { TranscriptEntryInput } from '@nexoprep/types'
import type { UpdateSessionStateInput } from '@nexoprep/session-service'

export async function registerSessionRoutes(server: FastifyInstance): Promise<void> {
  server.post('/', async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid session payload', parsed.error.flatten())
    const session = await server.container.sessionService.createSession(parsed.data)
    return reply.status(201).send({ session })
  })

  server.get('/:sessionId', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    const session = await server.container.prisma.interviewSession.findUnique({
      where: { id: params.sessionId },
      include: {
        rounds: { orderBy: { sequence: 'asc' } },
        transcripts: { orderBy: { sequence: 'asc' } },
        behaviorMetrics: true,
        emotionStates: true,
        scores: true,
        feedbackReport: true,
        roadmap: true,
        eventLogs: { orderBy: { occurredAt: 'desc' }, take: 100 },
      },
    })
    return { session }
  })

  server.get('/:sessionId/state', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    const state = await server.container.sessionService.restoreSession(params.sessionId)
    return { state }
  })

  server.patch('/:sessionId/state', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsed = updateSessionStateSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid session state payload', parsed.error.flatten())
    const stateInput: UpdateSessionStateInput = parsed.data
    const state = await server.container.sessionService.updateState(params.sessionId, stateInput)
    return { state }
  })

  server.post('/:sessionId/transcripts', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsed = appendTranscriptSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid transcript payload', parsed.error.flatten())
    const transcriptInput: TranscriptEntryInput = {
      ...parsed.data,
      sessionId: params.sessionId,
    }
    const transcript = await server.container.sessionService.appendTranscript(transcriptInput)
    return reply.status(201).send({ transcript })
  })

  // Read-only monitoring endpoint — never used to control the Behavior
  // Engine lifecycle (that's driven entirely by SESSION_STARTED /
  // SESSION_UPDATED events). Lets the UI show tracking availability
  // without any popup/manual-launch logic.
  server.get('/:sessionId/behavior/status', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    const status = server.container.behaviorEngine.getStatus(params.sessionId)
    return { status: status ?? { status: 'unavailable', pid: null, exitCode: null } }
  })

  // Proxies the Python engine's local-only MJPEG stream through to the
  // browser. React never talks to the Python process directly — this is
  // the only door in, and it only opens while a stream is actually
  // running for this session (see BehaviorEngineService.getStreamTarget).
  // Kept as a raw pass-through (not JSON) so an <img> tag can point
  // straight at it with zero client-side streaming code.
  server.get('/:sessionId/behavior/stream', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const target = server.container.behaviorEngine.getStreamTarget(params.sessionId)

    if (!target) {
      return reply.status(404).send({
        error: { code: 'BEHAVIOR_STREAM_UNAVAILABLE', message: 'No active behavior stream for this session' },
      })
    }

    reply.hijack()
    const upstream = httpGet({ host: target.host, port: target.port, path: '/stream.mjpg' }, (upstreamRes) => {
      reply.raw.writeHead(upstreamRes.statusCode ?? 200, upstreamRes.headers)
      upstreamRes.pipe(reply.raw)
    })
    upstream.on('error', (error) => {
      request.log.warn({ error, sessionId: params.sessionId }, '[BEHAVIOR_ENGINE_STREAM_PROXY_ERROR]')
      if (!reply.raw.headersSent) reply.raw.writeHead(502)
      reply.raw.end()
    })
    request.raw.on('close', () => upstream.destroy())
  })

  // Proxies the Python engine's small live-metrics JSON snapshot
  // (eyeContact/posture/gesture/headStability/confidence/behaviorScore —
  // all values the engine already computes each frame, see
  // engine.py:_metrics_snapshot). Unlike the stream route this is a
  // one-shot JSON response, not a continuous pipe, so it's buffered
  // rather than hijacked. 503/404 from upstream (engine still starting,
  // or no metrics published yet) is forwarded as 503 — BehaviorCameraCard
  // treats that as "not ready yet", not an error.
  server.get('/:sessionId/behavior/metrics', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const target = server.container.behaviorEngine.getStreamTarget(params.sessionId)

    if (!target) {
      return reply.status(503).send({
        error: { code: 'BEHAVIOR_METRICS_UNAVAILABLE', message: 'No active behavior engine for this session' },
      })
    }

    try {
      const body = await new Promise<string>((resolvePromise, rejectPromise) => {
        const upstream = httpGet({ host: target.host, port: target.port, path: '/metrics.json' }, (upstreamRes) => {
          if (upstreamRes.statusCode !== 200) {
            rejectPromise(new Error(`upstream status ${upstreamRes.statusCode}`))
            upstreamRes.resume()
            return
          }
          const chunks: Buffer[] = []
          upstreamRes.on('data', (chunk: Buffer) => chunks.push(chunk))
          upstreamRes.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')))
        })
        upstream.on('error', rejectPromise)
      })
      reply.header('Content-Type', 'application/json')
      return reply.status(200).send(body)
    } catch (error) {
      request.log.debug({ error, sessionId: params.sessionId }, '[BEHAVIOR_ENGINE_METRICS_PROXY_ERROR] not ready yet')
      return reply.status(503).send({
        error: { code: 'BEHAVIOR_METRICS_UNAVAILABLE', message: 'Metrics not published yet' },
      })
    }
  })
}
