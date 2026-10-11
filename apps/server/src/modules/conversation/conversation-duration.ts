import type { DatabaseClient } from '@nexoprep/database'

/**
 * How long a voice interview really lasted: first to last saved transcript line.
 *
 * The session row is created on the setup page and can be resumed hours (or a day) later, so
 * `completedAt - startedAt` measures how long the session existed, not how long the candidate
 * talked. A 30-second conversation on a session created yesterday must not report 18 hours.
 * Returns 0 when nothing was said.
 */
export async function measureConversationSeconds(
  prisma: Pick<DatabaseClient, 'transcript'>,
  sessionId: string,
): Promise<number> {
  const span = await prisma.transcript.aggregate({
    where: { sessionId },
    _min: { createdAt: true },
    _max: { createdAt: true },
  })
  const first = span._min.createdAt
  const last = span._max.createdAt
  if (!first || !last) return 0
  return Math.max(0, Math.round((last.getTime() - first.getTime()) / 1000))
}
