import type { FastifyInstance } from 'fastify'

export async function registerHealthRoutes(server: FastifyInstance): Promise<void> {
  server.get('/health', async () => ({
    status: 'ok',
    service: 'nexoprep-server',
    time: new Date().toISOString(),
  }))

  server.get('/ready', async () => {
    await server.container.prisma.$queryRaw`SELECT 1`
    await server.container.redis.ping()
    return {
      status: 'ready',
      dependencies: {
        postgres: 'ok',
        redis: 'ok',
      },
    }
  })
}
