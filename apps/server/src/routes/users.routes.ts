import type { FastifyInstance } from 'fastify'
import { createUserSchema, paginationQuerySchema, userIdParamSchema, ValidationError } from '@nexoprep/shared'

export async function registerUserRoutes(server: FastifyInstance): Promise<void> {
  server.post('/', async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid user payload', parsed.error.flatten())

    const user = await server.container.prisma.user.upsert({
      where: { email: parsed.data.email },
      update: parsed.data,
      create: parsed.data,
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
