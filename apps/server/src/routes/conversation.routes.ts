import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { sessionIdParamSchema, ValidationError } from '@nexoprep/shared'
import { z } from 'zod'
import type { ConversationPublisher } from '../modules/realtime/conversation-publisher.js'

const startSchema = z.object({
  userId: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1),
  difficulty: z.string().min(1),
  candidateName: z.string().optional(),
  resumeText: z.string().optional(),
  resumeSummary: z.string().optional(),
  skills: z.array(z.string()).optional(),
  projects: z.array(z.string()).optional(),
  experience: z.array(z.string()).optional(),
})

const transcriptChunkSchema = z.object({
  userId: z.string().min(1),
  speaker: z.enum(['candidate', 'interviewer', 'system', 'ai']),
  content: z.string().min(1),
  isFinal: z.boolean().default(false),
  sequence: z.number().int().min(0).optional(),
})

const endSchema = z.object({
  userId: z.string().min(1),
})

function mapSpeaker(speaker: string): 'candidate' | 'interviewer' | 'system' | 'ai' {
  if (speaker === 'candidate' || speaker === 'user') return 'candidate'
  if (speaker === 'ai' || speaker === 'agent' || speaker === 'interviewer') return 'ai'
  return 'system'
}

async function appendLocalLog(baseDir: string, sessionId: string, entry: Record<string, unknown>): Promise<void> {
  try {
    const dir = join(baseDir, sessionId)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'transcript.log'), `${JSON.stringify(entry)}\n`, { flag: 'a' })
  } catch {
    // optional debug only
  }
}

export async function registerConversationRoutes(server: FastifyInstance): Promise<void> {
  const publisher = server.container.conversationPublisher as ConversationPublisher

  server.get('/elevenlabs-agent-audit', async () => {
    const audit = await server.container.elevenLabs.getAgentAudit()
    console.log('[ELEVENLABS_AGENT_CONFIG]', audit)
    if (audit?.customLlmUrl) {
      console.log('[CUSTOM_LLM_URL]', { customLlmUrl: audit.customLlmUrl, apiType: audit.customLlmApiType })
    }
    return { audit }
  })

  server.post('/sessions/:sessionId/start', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsed = startSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid conversation start payload', parsed.error.flatten())

    request.log.info({ sessionId: params.sessionId, userId: parsed.data.userId }, 'conversation start request')
    const existing = await server.container.conversationMemory.get(params.sessionId)
    if (!existing || existing.lifecycle === 'completed') {
      await server.container.conversationMemory.init({
        sessionId: params.sessionId,
        userId: parsed.data.userId,
        role: parsed.data.role,
        company: parsed.data.company,
        difficulty: parsed.data.difficulty,
      })
    } else {
      request.log.info({ sessionId: params.sessionId }, 'conversation start idempotent — reusing active session')
    }

    const resumeRecord = await server.container.resumeService.getLatest(parsed.data.userId)
    const dbProfile = resumeRecord
      ? server.container.candidateProfileService.fromResumeAnalysis(resumeRecord)
      : null
    const rawAnalysis = (resumeRecord?.rawAnalysis || {}) as Record<string, unknown>
    const dbResumeSnippet = typeof rawAnalysis.resumeSnippet === 'string' ? rawAnalysis.resumeSnippet : undefined

    const user = await server.container.prisma.user.findUnique({ where: { id: parsed.data.userId } })
    const frontendProfile =
      parsed.data.skills?.length || parsed.data.projects?.length
        ? {
            skills: parsed.data.skills || [],
            projects: parsed.data.projects || [],
            experience: parsed.data.experience || [],
            education: [] as string[],
            technologies: parsed.data.skills || [],
          }
        : null

    const resumeText = parsed.data.resumeText || dbResumeSnippet
    let mergedProfile = dbProfile
    if (frontendProfile) {
      mergedProfile = {
        skills: [...new Set([...(mergedProfile?.skills || []), ...frontendProfile.skills])],
        projects: frontendProfile.projects.length
          ? frontendProfile.projects
          : mergedProfile?.projects || [],
        experience: frontendProfile.experience.length
          ? frontendProfile.experience
          : mergedProfile?.experience || [],
        education: mergedProfile?.education || [],
        technologies: [...new Set([...(mergedProfile?.technologies || []), ...frontendProfile.technologies])],
      }
    }
    if (resumeText && !mergedProfile) {
      mergedProfile = server.container.candidateProfileService.fromResumeText(resumeText)
    } else if (resumeText && mergedProfile) {
      const fromText = server.container.candidateProfileService.fromResumeText(
        resumeText,
        mergedProfile.skills,
      )
      mergedProfile = {
        skills: [...new Set([...mergedProfile.skills, ...fromText.skills])],
        projects: fromText.projects.length ? fromText.projects : mergedProfile.projects,
        experience: fromText.experience.length ? fromText.experience : mergedProfile.experience,
        education: fromText.education.length ? fromText.education : mergedProfile.education,
        technologies: [...new Set([...mergedProfile.technologies, ...fromText.technologies])],
      }
    }

    const resumeSummary =
      parsed.data.resumeSummary ||
      server.container.candidateProfileService.buildResumeSummaryFromProfile(mergedProfile, resumeText)

    await server.container.interviewEngine.initializeInterview(
      params.sessionId,
      {
        userId: parsed.data.userId,
        role: parsed.data.role,
        company: parsed.data.company,
        difficulty: parsed.data.difficulty,
        candidateName: parsed.data.candidateName || user?.name || 'Candidate',
        ...(resumeText ? { resumeText } : {}),
        ...(resumeSummary ? { resumeSummary } : {}),
      },
      mergedProfile,
    )

    const memory = await server.container.conversationMemory.get(params.sessionId)

    const token = server.container.elevenLabs.isConfigured()
      ? await server.container.elevenLabs.getConversationToken(params.sessionId)
      : null

    const elevenLabsAudit = await server.container.elevenLabs.getAgentAudit()
    console.log('[ELEVENLABS_AGENT_CONFIG]', elevenLabsAudit)
    if (elevenLabsAudit?.customLlmUrl) {
      console.log('[CUSTOM_LLM_URL]', {
        customLlmUrl: elevenLabsAudit.customLlmUrl,
        apiType: elevenLabsAudit.customLlmApiType,
        customLlmEnabled: elevenLabsAudit.customLlmEnabled,
        customLlmExtraBodyOverrideEnabled: elevenLabsAudit.customLlmExtraBodyOverrideEnabled,
        backupLlmPreference: elevenLabsAudit.backupLlmPreference,
        backupLlmOrder: elevenLabsAudit.backupLlmOrder,
      })
    }
    if (elevenLabsAudit && !elevenLabsAudit.customLlmExtraBodyOverrideEnabled) {
      console.warn('[ELEVENLABS_AGENT_CONFIG]', {
        warning: 'custom_llm_extra_body override is disabled — frontend customLlmExtraBody will trigger override_error and skip Custom LLM',
      })
    }

    const activeCount = await server.container.conversationMemory.countActive()
    request.log.info(
      { sessionId: params.sessionId, activeConversations: activeCount, tokenIssued: Boolean(token) },
      'conversation started',
    )

    await publisher.publish('CONVERSATION_STARTED', {
      sessionId: params.sessionId,
      userId: parsed.data.userId,
      lifecycle: 'connecting',
    })

    return reply.status(existing && existing.lifecycle !== 'completed' ? 200 : 201).send({
      memory,
      conversationToken: token,
      agentId: server.config.ELEVENLABS_AGENT_ID ?? null,
      geminiConfigured: server.container.gemini.isConfigured(),
      elevenLabsConfigured: server.container.elevenLabs.isConfigured(),
      elevenLabsAudit,
    })
  })

  server.post('/sessions/:sessionId/heartbeat', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    const body = z
      .object({
        userId: z.string().min(1),
        connectionHealth: z.string(),
        transportReady: z.boolean(),
        lifecycle: z.string().optional(),
      })
      .parse(request.body)
    request.log.debug(
      { sessionId: params.sessionId, connectionHealth: body.connectionHealth, transportReady: body.transportReady },
      'conversation heartbeat',
    )
    const memory = await server.container.conversationMemory.recordHeartbeat(params.sessionId, {
      connectionHealth: body.connectionHealth,
      transportReady: body.transportReady,
      ...(body.lifecycle ? { lifecycle: body.lifecycle } : {}),
    })
    return { ok: true, memory }
  })

  server.get('/sessions/:sessionId/token', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    request.log.info({ sessionId: params.sessionId }, 'conversation token request')
    const token = await server.container.elevenLabs.getConversationToken(params.sessionId)
    request.log.info({ sessionId: params.sessionId, tokenIssued: Boolean(token) }, 'conversation token issued')
    return { conversationToken: token, agentId: server.config.ELEVENLABS_AGENT_ID }
  })

  server.get('/sessions/:sessionId/memory', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    const memory = await server.container.conversationMemory.get(params.sessionId)
    return { memory }
  })

  server.get('/sessions/:sessionId/orchestrator-debug', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    const memory = await server.container.conversationMemory.get(params.sessionId)
    if (!memory) return { debug: null }
    const debug = server.container.interviewEngine.getDebugSnapshot(memory)
    const promptContext = server.container.orchestrator.getPromptContext(memory)
    return {
      debug: {
        ...debug,
        currentPromptContext: promptContext.snapshot,
        systemPromptPreview: promptContext.systemPromptPreview,
      },
    }
  })

  server.patch('/sessions/:sessionId/lifecycle', async (request) => {
    const params = sessionIdParamSchema.parse(request.params)
    const body = z.object({ lifecycle: z.string() }).parse(request.body)
    const memory = await server.container.conversationMemory.setLifecycle(
      params.sessionId,
      body.lifecycle as never,
    )
    return { memory }
  })

  server.post('/sessions/:sessionId/transcript-chunk', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsed = transcriptChunkSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid transcript chunk', parsed.error.flatten())

    const speaker = mapSpeaker(parsed.data.speaker)
    request.log.debug(
      {
        sessionId: params.sessionId,
        userId: parsed.data.userId,
        speaker,
        isFinal: parsed.data.isFinal,
        sequence: parsed.data.sequence,
      },
      'conversation transcript ingestion',
    )
    await server.container.conversationMemory.appendTranscript(params.sessionId, {
      speaker,
      content: parsed.data.content,
      isFinal: parsed.data.isFinal,
    })

    const eventType = parsed.data.isFinal ? 'TRANSCRIPT_FINAL' : 'TRANSCRIPT_PARTIAL'
    await publisher.publish(eventType, {
      sessionId: params.sessionId,
      userId: parsed.data.userId,
      speaker,
      content: parsed.data.content,
      sequence: parsed.data.sequence,
    })

    if (parsed.data.isFinal) {
      const session = await server.container.prisma.interviewSession.findUnique({ where: { id: params.sessionId } })
      if (session) {
        const latest = await server.container.prisma.transcript.findFirst({
          where: { sessionId: params.sessionId },
          orderBy: { sequence: 'desc' },
        })
        const sequence = parsed.data.sequence ?? (latest?.sequence ?? -1) + 1
        const transcript = await server.container.sessionService.appendTranscript({
          sessionId: params.sessionId,
          speaker,
          content: parsed.data.content,
          sequence,
          metadata: { isFinal: true, source: 'conversation' },
        })

        await publisher.publish('TRANSCRIPT_FINAL', {
          sessionId: params.sessionId,
          userId: parsed.data.userId,
          speaker,
          content: parsed.data.content,
          sequence: transcript.sequence,
          transcriptId: transcript.id,
        })

        await appendLocalLog(server.config.CONVERSATION_LOCAL_LOG_DIR, params.sessionId, {
          at: new Date().toISOString(),
          speaker,
          content: parsed.data.content,
          sequence: transcript.sequence,
        })
      }
    }

    return reply.status(parsed.data.isFinal ? 201 : 200).send({ ok: true })
  })

  server.post('/sessions/:sessionId/end', async (request, reply) => {
    const params = sessionIdParamSchema.parse(request.params)
    const parsed = endSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid conversation end payload', parsed.error.flatten())

    request.log.info({ sessionId: params.sessionId, userId: parsed.data.userId }, 'conversation end request')
    await server.container.interviewEngine.finalizeInterview(params.sessionId, parsed.data.userId)
    await server.container.conversationMemory.setLifecycle(params.sessionId, 'completed')
    await server.container.sessionService.updateState(params.sessionId, {
      status: 'completed',
      metadata: { lifecycle: 'completed', conversationMode: true },
    })

    await publisher.publish('CONVERSATION_ENDED', {
      sessionId: params.sessionId,
      userId: parsed.data.userId,
      lifecycle: 'completed',
    })

    await server.container.conversationMemory.clear(params.sessionId)
    const activeCount = await server.container.conversationMemory.countActive()
    request.log.info({ sessionId: params.sessionId, activeConversations: activeCount }, 'conversation cleanup completed')

    return reply.status(200).send({ ok: true })
  })
}
