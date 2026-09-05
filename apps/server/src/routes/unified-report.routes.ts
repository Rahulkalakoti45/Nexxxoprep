import type { FastifyInstance } from 'fastify'
import { sessionIdParamSchema, ValidationError } from '@nexoprep/shared'
import { z } from 'zod'

// There is no authentication layer in this codebase (see ReportService,
// ResumeService): callers explicitly pass userId, and ownership is
// enforced by comparing it against the session's own userId. GET routes
// have no body, so userId is accepted as a query param here.
const unifiedReportQuerySchema = z.object({
  userId: z.string().min(1),
})

export async function registerUnifiedReportRoutes(server: FastifyInstance): Promise<void> {
  server.get('/:sessionId', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsedQuery = unifiedReportQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) throw new ValidationError('Invalid unified report query', parsedQuery.error.flatten())

    const report = await server.container.unifiedReportService.getUnifiedReport(
      params.sessionId,
      parsedQuery.data.userId,
    )
    return { report }
  })
}
