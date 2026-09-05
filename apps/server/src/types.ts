import type { DatabaseClient } from '@nexoprep/database'
import type { Redis } from 'ioredis'
import type { EventBus, RedisEventBus } from '@nexoprep/events'
import type { AnalyticsService } from '@nexoprep/analytics-service'
import type { MemoryService } from '@nexoprep/memory-service'
import type { ReportService } from '@nexoprep/report-service'
import type { SessionService } from '@nexoprep/session-service'
import type { ConversationMemoryService } from './modules/conversation/memory.service.js'
import type { ElevenLabsService } from './modules/conversation/elevenlabs.service.js'
import type { EvidenceExtractionService } from './modules/evidence/evidence-extraction.service.js'
import type { CandidateProfileService } from './modules/orchestrator/candidate-profile.service.js'
import type { GeminiService } from './modules/orchestrator/gemini.service.js'
import type { InterviewEngineService } from './modules/orchestrator/interview-engine.service.js'
import type { OrchestratorService } from './modules/orchestrator/orchestrator.service.js'
import type { ConversationPublisher } from './modules/realtime/conversation-publisher.js'
import type { BehaviorEngineService } from './modules/behavior/behavior-engine.service.js'
import type { BehaviorReportIngestionService } from './modules/behavior/behavior-report-ingestion.service.js'
import type { ResumeService } from './services/resume.service.js'

export interface AppContainer {
  prisma: DatabaseClient
  redis: Redis
  eventBus: EventBus
  redisEventBus?: RedisEventBus
  memoryService: MemoryService
  sessionService: SessionService
  reportService: ReportService
  analyticsService: AnalyticsService
  conversationMemory: ConversationMemoryService
  elevenLabs: ElevenLabsService
  gemini: GeminiService
  orchestrator: OrchestratorService
  interviewEngine: InterviewEngineService
  evidenceExtractionService: EvidenceExtractionService
  candidateProfileService: CandidateProfileService
  resumeService: ResumeService
  conversationPublisher: ConversationPublisher
  behaviorEngine: BehaviorEngineService
  behaviorReportIngestion: BehaviorReportIngestionService
  close(): Promise<void>
}
