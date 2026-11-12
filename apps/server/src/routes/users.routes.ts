import type { FastifyInstance } from 'fastify'
import { createUserSchema, paginationQuerySchema, userIdParamSchema, ValidationError } from '@nexoprep/shared'

export async function registerUserRoutes(server: FastifyInstance): Promise<void> {
  server.post('/', async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid user payload', parsed.error.flatten())

    // Prisma rejects explicit `undefined` under exactOptionalPropertyTypes, so optional fields the
    // client left out are dropped rather than passed through.
    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    ) as { email: string; name: string } & Partial<Record<'college' | 'branch' | 'targetRole' | 'experienceLevel', string>> & { graduationYear?: number }

    const user = await server.container.prisma.user.upsert({
      where: { email: data.email },
      update: data,
      create: data,
    })

    return reply.status(201).send({ user })
  })

  server.get('/:userId/history', async (request) => {
    const params = userIdParamSchema.parse(request.params)
    const query = paginationQuerySchema.parse(request.query)
    const sessions = await server.container.sessionService.getHistory(params.userId, query.limit)
    return { sessions }
  })
}
