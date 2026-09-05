import type { FastifyBaseLogger } from 'fastify'
import { AnalyticsService } from '@nexoprep/analytics-service'
import type { AppConfig } from '@nexoprep/config'
import { createPrismaClient } from '@nexoprep/database'
import { createRedisClient, RedisEventBus } from '@nexoprep/events'
import { MemoryService } from '@nexoprep/memory-service'
import { ReportService } from '@nexoprep/report-service'
import { SessionService } from '@nexoprep/session-service'
import { ConversationMemoryService } from './modules/conversation/memory.service.js'
import { ElevenLabsService } from './modules/conversation/elevenlabs.service.js'
import { EvidenceExtractionService } from './modules/evidence/evidence-extraction.service.js'
import { AnswerScoringService } from './modules/orchestrator/answer-scoring.service.js'
import { CandidateProfileService } from './modules/orchestrator/candidate-profile.service.js'
import { GeminiService } from './modules/orchestrator/gemini.service.js'
import { InterviewEngineService } from './modules/orchestrator/interview-engine.service.js'
import { InterviewSummaryService } from './modules/orchestrator/interview-summary.service.js'
import { OrchestratorService } from './modules/orchestrator/orchestrator.service.js'
import { QuestionDiversityService } from './modules/orchestrator/question-diversity.service.js'
import { ConversationPublisher } from './modules/realtime/conversation-publisher.js'
import { BehaviorEngineService } from './modules/behavior/behavior-engine.service.js'
import { BehaviorEngineOrchestrator } from './modules/behavior/behavior-engine.orchestrator.js'
import { BehaviorReportIngestionService } from './modules/behavior/behavior-report-ingestion.service.js'
import { ResumeService } from './services/resume.service.js'
import type { AppContainer } from './types.js'

export async function buildContainer(config: AppConfig, logger: FastifyBaseLogger): Promise<AppContainer> {
  const prisma = createPrismaClient(config.DATABASE_URL)
  const redis = createRedisClient(config.REDIS_URL)
  const eventBus = new RedisEventBus({
    redisUrl: config.REDIS_URL,
    streamMaxLen: config.EVENT_STREAM_MAXLEN,
  })

  await Promise.all([redis.connect(), eventBus.connect(), prisma.$connect()])
  logger.info('database, redis, and event bus connected')

  const memoryService = new MemoryService(redis, {
    sessionTtlSeconds: config.SESSION_CACHE_TTL_SECONDS,
    transcriptBufferTtlSeconds: config.TRANSCRIPT_BUFFER_TTL_SECONDS,
  })

  const sessionService = new SessionService(prisma, memoryService, eventBus)
  const reportService = new ReportService(prisma, eventBus)
  const analyticsService = new AnalyticsService(prisma)
  const conversationMemory = new ConversationMemoryService(redis, config.CONVERSATION_MEMORY_TTL_SECONDS)
  const elevenLabs = new ElevenLabsService(config)
  if (elevenLabs.isConfigured()) {
    try {
      const enabled = await elevenLabs.ensureCustomLlmExtraBodyOverride()
      const audit = await elevenLabs.getAgentAudit()
      logger.info({ enabled, audit }, '[ELEVENLABS_AGENT_CONFIG] startup audit')
      if (audit?.customLlmUrl) {
        logger.info({ customLlmUrl: audit.customLlmUrl }, '[CUSTOM_LLM_URL]')
      }
    } catch (error) {
      logger.warn({ error }, 'failed to audit or patch ElevenLabs agent overrides')
    }
  }
  const gemini = new GeminiService(config)
  gemini.runBootDiagnostics()
  const candidateProfileService = new CandidateProfileService()
  const questionDiversityService = new QuestionDiversityService()
  const answerScoringService = new AnswerScoringService()
  const interviewSummaryService = new InterviewSummaryService(gemini)
  const evidenceExtractionService = new EvidenceExtractionService(prisma)
  const interviewEngine = new InterviewEngineService(
    conversationMemory,
    candidateProfileService,
    answerScoringService,
    questionDiversityService,
    interviewSummaryService,
    reportService,
    prisma,
    evidenceExtractionService,
  )
  const orchestrator = new OrchestratorService(gemini, candidateProfileService, questionDiversityService)
  const conversationPublisher = new ConversationPublisher(eventBus)
  const resumeService = new ResumeService(prisma)

  const behaviorReportIngestion = new BehaviorReportIngestionService(prisma, eventBus, logger)
  const behaviorEngine = new BehaviorEngineService(config, logger, (info) => {
    void behaviorReportIngestion.handleReportFinalized(info)
  })
  const behaviorEngineOrchestrator = new BehaviorEngineOrchestrator(behaviorEngine, eventBus, logger)
  await behaviorEngineOrchestrator.start()

  return {
    prisma,
    redis,
    eventBus,
    redisEventBus: eventBus,
    memoryService,
    sessionService,
    reportService,
    analyticsService,
    conversationMemory,
    elevenLabs,
    gemini,
    orchestrator,
    interviewEngine,
    evidenceExtractionService,
    candidateProfileService,
    resumeService,
    conversationPublisher,
    behaviorEngine,
    behaviorReportIngestion,
    async close() {
      await behaviorEngineOrchestrator.stop()
      await Promise.allSettled([eventBus.disconnect(), redis.quit(), prisma.$disconnect()])
    },
  }
}
