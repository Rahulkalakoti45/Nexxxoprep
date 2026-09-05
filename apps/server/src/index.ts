import { buildServer } from './server.js'

const server = await buildServer()

const shutdown = async (signal: string) => {
  server.log.info({ signal }, 'shutting down server')
  await server.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await server.listen({
    host: server.config.SERVER_HOST,
    port: server.config.SERVER_PORT,
  })
} catch (error) {
  server.log.error({ error }, 'failed to start server')
  process.exit(1)
}
