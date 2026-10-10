import { get as httpGet } from 'node:http'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  appendTranscriptSchema,
  createSessionSchema,
  NotFoundError,
  sessionIdParamSchema,
  updateSessionStateSchema,
  ValidationError,
} from '@nexoprep/shared'
import { toPrismaJson } from '@nexoprep/database'
import type { TranscriptEntryInput } from '@nexoprep/types'
import type { UpdateSessionStateInput } from '@nexoprep/session-service'

const score = z.number().min(0).max(10)

// Aggregated output of the in-browser behavior analysis (src/features/behavior/analysis.js).
// Only scores and counts: no video, images or landmarks ever reach the backend.
const behaviorSummarySchema = z.object({
  final: z.boolean().default(false),
  summary: z.object({
    durationSeconds: z.number().min(0).max(24 * 3600),
    samples: z.number().int().min(0).max(100_000),
    avgScores: z.object({
      posture: score,
      movement: score,
      eyeContact: score,
      expression: score,
      gesture: score,
      overall: score,
      engagement: score,
      attention: score,
    }),
    percentages: z.record(z.string().max(40), z.number().min(0).max(100)),
    gestureObserved: z.boolean().optional(),
    strongestSignal: z.string().max(40),
    weakestSignal: z.string().max(40),
    behavioralPresence: score,
    eventCounts: z.record(z.string().max(80), z.number().int().min(0).max(100_000)),
    totalEvents: z.number().int().min(0).max(100_000),
    events: z
      .array(
        z.object({
          time: z.number().min(0),
          type: z.string().max(80),
          detail: z.string().max(300),
          severity: z.enum(['low', 'medium', 'high']),
        }),
      )
      .max(100),
    trends: z.record(z.string().max(40), z.string().max(40)),
  }),
})

// metricType -> where it lives in avgScores; stored as raw rows next to the session's other metrics.
const BEHAVIOR_METRIC_FIELDS = [
  ['behavior_posture', 'posture'],
  ['behavior_movement', 'movement'],
  ['behavior_eye_contact', 'eyeContact'],
  ['behavior_expression', 'expression'],
  ['behavior_gesture', 'gesture'],
  ['behavior_engagement', 'engagement'],
  ['behavior_attention', 'attention'],
  ['behavior_overall', 'overall'],
] as const

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

  // Receives the behavior analysis computed in the candidate's browser (the hosted
  // deployment has no webcam for the Python engine to read). Partial summaries arrive
  // while the interview runs; `final: true` closes the report and records the raw
  // metric rows. Stored in the same session.metadata.behaviorReport slot the Python
  // engine's ingestion uses, so the report page reads one place for both.
  server.post('/:sessionId/behavior/summary', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsed = behaviorSummarySchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid behavior summary payload', parsed.error.flatten())
    const { summary, final } = parsed.data
    const { prisma } = server.container

    const session = await prisma.interviewSession.findUnique({ where: { id: params.sessionId }, select: { id: true } })
    if (!session) throw new NotFoundError('Interview session', { sessionId: params.sessionId })

    const now = new Date().toISOString()
    const behaviorReport = {
      source: 'browser',
      readyAt: now,
      finalizedAt: final ? now : null,
      behaviorScore: summary.avgScores.overall,
      engagementScore: summary.avgScores.engagement,
      attentionScore: summary.avgScores.attention,
      warningCount: summary.totalEvents,
      aggregation: summary,
    }

    // A single atomic statement that replaces only the behaviorReport key, so it cannot
    // clobber other metadata written concurrently by the voice flow, and that does nothing
    // once a final summary (or the Python engine's report pointer) is already stored.
    const updated = await prisma.$executeRaw`
      UPDATE "interview_sessions"
      SET "metadata" = jsonb_set(
            CASE WHEN jsonb_typeof("metadata") = 'object' THEN "metadata" ELSE '{}'::jsonb END,
            '{behaviorReport}',
            ${JSON.stringify(behaviorReport)}::jsonb,
            true
          ),
          "updatedAt" = NOW()
      WHERE "id" = ${params.sessionId}
        AND COALESCE("metadata" #>> '{behaviorReport,finalizedAt}', '') = ''
        AND COALESCE("metadata" #>> '{behaviorReport,sessionDir}', '') = ''`
    if (updated === 0) return reply.status(200).send({ stored: false, reason: 'already_finalized' })

    if (final) {
      const capturedAt = new Date()
      const metadata = toPrismaJson({ samples: summary.samples, durationSeconds: summary.durationSeconds })
      await prisma.behaviorMetric.createMany({
        data: BEHAVIOR_METRIC_FIELDS.map(([metricType, field]) => ({
          sessionId: params.sessionId,
          metricType,
          value: summary.avgScores[field],
          source: 'browser_mediapipe',
          capturedAt,
          metadata,
        })),
      })
    }
    return { stored: true, final }
  })
}
