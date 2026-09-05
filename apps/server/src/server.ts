import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import { loadConfig } from '@nexoprep/config'
import { AppError } from '@nexoprep/shared'
import { buildContainer } from './container.js'
import { registerRoutes } from './routes/index.js'
import { registerRealtimeGateway } from './websocket/realtime.js'
import type { AppContainer } from './types.js'

declare module 'fastify' {
  interface FastifyInstance {
    container: AppContainer
    config: ReturnType<typeof loadConfig>
  }
}

export async function buildServer() {
  const config = loadConfig()
  const server = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.x-api-key', 'req.query.apiKey'],
    },
    requestIdHeader: 'x-correlation-id',
  })

  const container = await buildContainer(config, server.log)
  server.decorate('container', container)
  server.decorate('config', config)

  // crossOriginResourcePolicy: 'cross-origin' — the default 'same-origin' CORP
  // silently blocks the BehaviorCameraCard <img> MJPEG stream, which is loaded
  // as a no-cors cross-origin request from the Vite dev origin (:5173) against
  // the Fastify backend (:4000). This is enforced independently of @fastify/cors
  // and does not affect fetch()-based calls (e.g. BehaviorMetrics polling).
  await server.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
  await server.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-correlation-id'],
  })
  await server.register(websocket)

  server.addHook('preHandler', async (request) => {
    const publicPaths = ['/health', '/ready', '/ws/realtime', '/v1/chat/completions']
    if (publicPaths.some((path) => request.url.startsWith(path))) return
    const headerKey = request.headers['x-api-key']
    // Query-param fallback: only needed because the browser embeds the
    // behavior stream via a plain <img src>, which cannot set custom
    // headers. Same secret, same check — just a second place to read it
    // from, and only relevant for that one media endpoint in practice.
    const queryKey = (request.query as Record<string, unknown> | undefined)?.apiKey
    const apiKey = headerKey ?? queryKey
    if (apiKey !== config.API_KEY_DEV_ONLY) {
      throw new AppError('Invalid API key', { code: 'INVALID_API_KEY', statusCode: 401 })
    }
  })

  server.setErrorHandler((error, request, reply) => {
    const fastifyError = error as Error & { statusCode?: number }
    const statusCode = error instanceof AppError ? error.statusCode : fastifyError.statusCode ?? 500
    const code = error instanceof AppError ? error.code : 'INTERNAL_SERVER_ERROR'
    const details = error instanceof AppError ? error.details : undefined

    request.log.error({ error, code, details }, 'request failed')
    void reply.status(statusCode).send({
      error: {
        code,
        message: statusCode >= 500 ? 'Internal server error' : fastifyError.message,
        details,
        correlationId: request.id,
      },
    })
  })

  server.addHook('onClose', async () => {
    await container.close()
  })

  await registerRoutes(server)
  await registerRealtimeGateway(server)

  return server
}
