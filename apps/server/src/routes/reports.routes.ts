import type { FastifyInstance } from 'fastify'
import { generateReportSchema, paginationQuerySchema, sessionIdParamSchema, userIdParamSchema, ValidationError } from '@nexoprep/shared'
import type { ReportGenerationInput } from '@nexoprep/types'

export async function registerReportRoutes(server: FastifyInstance): Promise<void> {
  server.post('/sessions/:sessionId', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsed = generateReportSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid report payload', parsed.error.flatten())
    const reportInput: ReportGenerationInput = {
      ...parsed.data,
      sessionId: params.sessionId,
    }
    const report = await server.container.reportService.generateAndStoreReport(reportInput)
    return reply.status(201).send({ report })
  })

  server.get('/users/:userId', async (request) => {
    const params = userIdParamSchema.parse(request.params)
    const query = paginationQuerySchema.parse(request.query)
    const reports = await server.container.reportService.getHistoricalReports(params.userId, query.limit)
    return { reports }
  })
}
