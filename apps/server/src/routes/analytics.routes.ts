import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { userIdParamSchema, sessionIdParamSchema, ValidationError } from '@nexoprep/shared'
import type { BehaviorMetricInput, EmotionStateInput } from '@nexoprep/types'

const behaviorMetricSchema = z.object({
  metricType: z.string().min(1),
  value: z.number(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().min(1),
  capturedAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

const emotionStateSchema = z.object({
  emotion: z.string().min(1),
  intensity: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().min(1),
  capturedAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export async function registerAnalyticsRoutes(server: FastifyInstance): Promise<void> {
  server.get('/users/:userId', async (request) => {
    const params = userIdParamSchema.parse(request.params)
    const snapshot = await server.container.analyticsService.getUserSnapshot(params.userId)
    return { snapshot }
  })

  server.post('/sessions/:sessionId/behavior-metrics', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsed = behaviorMetricSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid behavior metric payload', parsed.error.flatten())
    const metricInput: BehaviorMetricInput = {
      ...parsed.data,
      sessionId: params.sessionId,
    }
    const metric = await server.container.analyticsService.recordBehaviorMetric(metricInput)
    return reply.status(201).send({ metric })
  })

  server.post('/sessions/:sessionId/emotion-states', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsed = emotionStateSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid emotion state payload', parsed.error.flatten())
    const stateInput: EmotionStateInput = {
      ...parsed.data,
      sessionId: params.sessionId,
    }
    const state = await server.container.analyticsService.recordEmotionState(stateInput)
    return reply.status(201).send({ state })
  })
}
