import type { FastifyInstance } from 'fastify'
import { registerAnalyticsRoutes } from './analytics.routes.js'
import { registerConversationRoutes } from './conversation.routes.js'
import { registerCustomLlmRoutes } from './custom-llm.routes.js'
import { registerDebugRoutes } from './debug.routes.js'
import { registerHealthRoutes } from './health.routes.js'
import { registerReportRoutes } from './reports.routes.js'
import { registerSessionRoutes } from './sessions.routes.js'
import { registerUserRoutes } from './users.routes.js'
import { registerResumeRoutes } from './resume.routes.js'
import { registerUnifiedReportRoutes } from './unified-report.routes.js'

export async function registerRoutes(server: FastifyInstance): Promise<void> {
  await registerHealthRoutes(server)
  await server.register(registerUserRoutes, { prefix: '/api/users' })
  await server.register(registerSessionRoutes, { prefix: '/api/sessions' })
  await server.register(registerReportRoutes, { prefix: '/api/reports' })
  await server.register(registerAnalyticsRoutes, { prefix: '/api/analytics' })
  await server.register(registerResumeRoutes, { prefix: '/api/resume' })
  await server.register(registerUnifiedReportRoutes, { prefix: '/api/unified-report' })
  await server.register(registerConversationRoutes, { prefix: '/api/conversation' })
  await server.register(registerDebugRoutes, { prefix: '/api/debug' })
  await registerCustomLlmRoutes(server)
}
