import { appendTranscript, createSession, getSession, updateSessionState } from './backend/sessionsApi.js'
import { recordBehaviorMetric } from './backend/analyticsApi.js'
import { enqueueSync } from '../lib/syncQueue.js'

function mapInterviewMode(mode) {
  if (mode === 'ai_simulated') return 'ai_simulated'
  if (mode === 'voice_realtime') return 'voice_realtime'
  return 'standard'
}

function buildRoundSeeds(localSession) {
  return (localSession?.rounds || []).map((round, index) => ({
    sequence: index,
    name: round.label,
    domain: round.domain || 'general',
  }))
}

function extractRoundIdMap(backendSession) {
  const fromMeta = backendSession?.metadata?.roundIdByLabel
  if (fromMeta && typeof fromMeta === 'object') return fromMeta

  const rounds = backendSession?.rounds || []
  return Object.fromEntries(rounds.map((round) => [round.name, round.id]))
}

export async function hydrateSessionFromBackend(localSession, backendSessionId) {
  const backend = await getSession(backendSessionId)
  if (!backend) return localSession

  const transcripts = backend.transcripts || []
  const maxSequence = transcripts.reduce((max, row) => Math.max(max, row.sequence ?? 0), -1)

  return {
    ...localSession,
    backendSessionId,
    userId: backend.userId,
    roundIdByLabel: extractRoundIdMap(backend),
    transcriptSequence: maxSequence + 1,
    lifecycle: backend.metadata?.lifecycle || backend.status,
  }
}

export async function createBackendSession({ userId, company, role, difficulty, interviewMode, localSessionId, rounds }) {
  const session = await createSession({
    userId,
    company,
    role,
    difficulty,
    mode: mapInterviewMode(interviewMode),
    metadata: {
      localSessionId,
      source: 'web',
      rounds: rounds || [],
      lifecycle: 'active',
    },
  })
  return session
}

export async function attachBackendToLocalSession(localSession, userId) {
  const backend = await createBackendSession({
    userId,
    company: localSession.company,
    role: localSession.role,
    difficulty: localSession.difficulty,
    interviewMode: localSession.interviewMode,
    localSessionId: localSession.sessionId,
    rounds: buildRoundSeeds(localSession),
  })

  return {
    ...localSession,
    backendSessionId: backend.id,
    userId,
    roundIdByLabel: extractRoundIdMap(backend),
    transcriptSequence: 0,
    lifecycle: 'active',
  }
}

function resolveRoundId(session, question) {
  const label = question?.round
  if (!label) return undefined
  return session?.roundIdByLabel?.[label]
}

export function syncTranscriptAnswer(backendSessionId, payload) {
  return enqueueSync(async () => {
    const { sequence, question, answer, roundId, startedAt, endedAt, session } = payload
    const resolvedRoundId = roundId ?? resolveRoundId(session, question)
    const content = [
      `Q: ${question?.question || question?.id || 'Question'}`,
      `A: ${answer?.trim() ? answer.trim() : '(skipped)'}`,
    ].join('\n')

    return appendTranscript(backendSessionId, {
      roundId: resolvedRoundId,
      speaker: 'candidate',
      content,
      sequence,
      startedAt,
      endedAt,
      metadata: {
        questionId: question?.id,
        roundLabel: question?.round,
        status: payload.status || 'answered',
      },
    })
  })
}

export async function markSessionCompleted(backendSessionId, { currentQuestionId } = {}) {
  await updateSessionState(backendSessionId, {
    status: 'completed',
    currentQuestionId,
    activeSpeaker: 'system',
    metadata: { lifecycle: 'completed' },
  })
}

export async function recordAnswerBehavior(backendSessionId, { hesitationScore, clarityScore }) {
  try {
    await recordBehaviorMetric(backendSessionId, {
      metricType: 'communication_hesitation',
      value: hesitationScore ?? 0,
      source: 'client_heuristic',
      metadata: { clarityScore },
    })
  } catch {
    // non-blocking
  }
}
