import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { paginationQuerySchema, userIdParamSchema, ValidationError } from '@nexoprep/shared'

const problemSchema = z.object({
  title: z.string().min(1).max(200),
  difficulty: z.string().max(20),
  prompt: z.string().max(4000),
  expectedComplexity: z.object({ time: z.string().max(60), space: z.string().max(60) }),
  followUps: z.array(z.string().max(300)).max(5).default([]),
})

const runSchema = z.object({
  passed: z.number().int().min(0),
  total: z.number().int().min(0),
  hiddenPassed: z.number().int().min(0).optional(),
  hiddenTotal: z.number().int().min(0).optional(),
  compileError: z.string().max(500).nullable().optional(),
  timedOut: z.boolean().optional(),
  failures: z
    .array(
      z.object({
        label: z.string().max(120).nullable().optional(),
        input: z.string().max(400).nullable().optional(),
        expected: z.string().max(400).nullable().optional(),
        actual: z.string().max(400).nullable().optional(),
        error: z.string().max(400).nullable().optional(),
        hidden: z.boolean().optional(),
      }),
    )
    .max(20)
    .default([]),
})

const messagesSchema = z
  .array(z.object({ role: z.enum(['interviewer', 'candidate']), content: z.string().max(2000) }))
  .max(80)
  .default([])

const languageSchema = z.enum(['javascript', 'python'])

const turnSchema = z.object({
  problem: problemSchema,
  stage: z.enum(['approach', 'coding', 'wrapup']),
  event: z.enum(['start', 'message', 'run', 'hint', 'submit']),
  language: languageSchema,
  code: z.string().max(20000).default(''),
  messages: messagesSchema,
  lastRun: runSchema.nullable().optional(),
  hint: z.string().max(400).nullable().optional(),
})

const evaluateSchema = z.object({
  problem: problemSchema,
  language: languageSchema,
  code: z.string().max(20000),
  messages: messagesSchema,
  finalRun: runSchema,
  hintsUsed: z.number().int().min(0).max(10),
  durationSeconds: z.number().min(0).max(6 * 3600),
})

const attemptSchema = z.object({
  id: z.string().min(1).max(120),
  problemId: z.string().min(1).max(80),
  problemTitle: z.string().min(1).max(200),
  difficulty: z.string().max(20),
  language: languageSchema,
  code: z.string().max(20000),
  messages: z
    .array(z.object({ role: z.enum(['interviewer', 'candidate']), content: z.string().max(4000), kind: z.string().max(20).optional() }))
    .max(120)
    .default([]),
  // The run and evaluation are stored as the browser produced them; only their headline numbers
  // are checked here.
  finalRun: z.looseObject({ passed: z.number().int().min(0), total: z.number().int().min(0), results: z.array(z.unknown()).max(60).optional() }),
  evaluation: z.looseObject({ overall: z.number(), verdict: z.enum(['strong', 'okay', 'weak']), generatedBy: z.enum(['gemini', 'local']) }),
  hintsUsed: z.number().int().min(0).max(10),
  durationSeconds: z.number().min(0).max(6 * 3600),
  finishedAt: z.iso.datetime(),
})

const saveAttemptSchema = z.object({ userId: z.string().min(1), attempt: attemptSchema })
const attemptParamsSchema = z.object({ userId: z.string().min(1), attemptId: z.string().min(1).max(120) })

/**
 * The AI coding interviewer. Stateless: the browser runs the code and keeps the conversation,
 * and sends what the interviewer needs on each call. Returns 503 when Gemini is not configured,
 * which the browser treats as "use the built-in scripted interviewer".
 */
export async function registerCodingRoutes(server: FastifyInstance): Promise<void> {
  server.post('/turn', async (request) => {
    const parsed = turnSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid coding turn payload', parsed.error.flatten())
    const turn = await server.container.codingInterviewer.turn(parsed.data)
    return { turn }
  })

  // Finished attempts, kept per user so they follow the candidate across devices. The browser's
  // attempt id is the key, so saving the same attempt twice updates it.
  server.post('/attempts', async (request, reply) => {
    const parsed = saveAttemptSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid coding attempt payload', parsed.error.flatten())
    const attempt = await server.container.codingAttempts.save(parsed.data.userId, parsed.data.attempt)
    return reply.status(201).send({ attempt })
  })

  server.get('/users/:userId/attempts', async (request) => {
    const params = userIdParamSchema.parse(request.params)
    const query = paginationQuerySchema.parse(request.query)
    const attempts = await server.container.codingAttempts.list(params.userId, query.limit)
    return { attempts }
  })

  server.get('/users/:userId/attempts/:attemptId', async (request) => {
    const params = attemptParamsSchema.parse(request.params)
    const attempt = await server.container.codingAttempts.get(params.userId, params.attemptId)
    return { attempt }
  })

  server.post('/evaluate', async (request) => {
    const parsed = evaluateSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid coding evaluation payload', parsed.error.flatten())
    const evaluation = await server.container.codingInterviewer.evaluate(parsed.data)
    return { evaluation }
  })
}
