import type { FastifyInstance } from 'fastify'
import { userIdParamSchema, ValidationError } from '@nexoprep/shared'
import { z } from 'zod'
import { ResumeService } from '../services/resume.service.js'

const analyzeResumeSchema = z.object({
  resumeText: z.string().min(50).max(50000),
  targetRole: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
})

export async function registerResumeRoutes(server: FastifyInstance): Promise<void> {
  const resumeService = new ResumeService(server.container.prisma)

  server.post('/users/:userId/analyze', async (request, reply) => {
    const params = userIdParamSchema.parse(request.params)
    const parsed = analyzeResumeSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid resume payload', parsed.error.flatten())

    const analysis = await resumeService.analyzeAndStore({
      userId: params.userId,
      resumeText: parsed.data.resumeText,
      ...(parsed.data.targetRole ? { targetRole: parsed.data.targetRole } : {}),
      ...(parsed.data.company ? { company: parsed.data.company } : {}),
    })

    return reply.status(201).send({ analysis })
  })

  server.get('/users/:userId/latest', async (request) => {
    const params = userIdParamSchema.parse(request.params)
    const analysis = await resumeService.getLatest(params.userId)
    return { analysis }
  })
}
