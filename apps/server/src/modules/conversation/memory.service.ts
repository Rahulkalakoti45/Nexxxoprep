import type { Redis } from 'ioredis'
import type {
  AnswerScore,
  CandidateProfile,
  ConversationLifecycle,
  FollowUpDirective,
  InterviewPlan,
  InterviewPlanProgress,
  InterviewStage,
  InterviewSummary,
} from '@nexoprep/types'
import { createEmptyPlanProgress, generateInterviewPlan } from '../orchestrator/interview-plan.service.js'

export interface ConversationMemory {
  sessionId: string
  userId: string
  role: string
  company: string
  difficulty: string
  lifecycle: ConversationLifecycle
  questionIndex: number
  askedQuestions: string[]
  topics: string[]
  recentTranscript: Array<{ speaker: string; content: string; at: string; isFinal?: boolean }>
  elevenLabsConversationId?: string
  lastHeartbeat?: string
  connectionHealth?: string
  transportReady?: boolean
  updatedAt: string
  interviewInitialized?: boolean
  interviewStage: InterviewStage
  interviewPlan: InterviewPlan
  planProgress: InterviewPlanProgress
  candidateProfile: CandidateProfile | null
  coveredTopics: string[]
  weakTopics: string[]
  strongTopics: string[]
  candidateStrengths: string[]
  candidateWeaknesses: string[]
  answerScores: AnswerScore[]
  questionTopics: string[]
  lastAnswerScore: AnswerScore | null
  lastFollowUp: FollowUpDirective | null
  interviewSummary: InterviewSummary | null
  candidateName?: string
  resumeSummary?: string
  firstQuestionPending?: boolean
}

export class ConversationMemoryService {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
  ) {}

  private key(sessionId: string): string {
    return `nexoprep:conversation:${sessionId}:memory`
  }

  private keyPattern(): string {
    return 'nexoprep:conversation:*:memory'
  }

  async get(sessionId: string): Promise<ConversationMemory | null> {
    const raw = await this.redis.get(this.key(sessionId))
    if (!raw) return null
    return this.normalize(JSON.parse(raw) as Partial<ConversationMemory> & { sessionId: string })
  }

  private normalize(partial: Partial<ConversationMemory> & { sessionId: string }): ConversationMemory {
    const difficulty = partial.difficulty || 'medium'
    return {
      sessionId: partial.sessionId,
      userId: partial.userId || '',
      role: partial.role || '',
      company: partial.company || '',
      difficulty,
      lifecycle: partial.lifecycle || 'connecting',
      questionIndex: partial.questionIndex ?? 0,
      askedQuestions: partial.askedQuestions ?? [],
      topics: partial.topics ?? [],
      recentTranscript: partial.recentTranscript ?? [],
      updatedAt: partial.updatedAt || new Date().toISOString(),
      ...(partial.elevenLabsConversationId ? { elevenLabsConversationId: partial.elevenLabsConversationId } : {}),
      ...(partial.lastHeartbeat ? { lastHeartbeat: partial.lastHeartbeat } : {}),
      ...(partial.connectionHealth ? { connectionHealth: partial.connectionHealth } : {}),
      ...(partial.transportReady !== undefined ? { transportReady: partial.transportReady } : {}),
      interviewInitialized: partial.interviewInitialized ?? false,
      interviewStage: partial.interviewStage || 'INTRODUCTION',
      interviewPlan: partial.interviewPlan || generateInterviewPlan(difficulty),
      planProgress: partial.planProgress || createEmptyPlanProgress(),
      candidateProfile: partial.candidateProfile ?? null,
      coveredTopics: partial.coveredTopics ?? partial.topics ?? [],
      weakTopics: partial.weakTopics ?? [],
      strongTopics: partial.strongTopics ?? [],
      candidateStrengths: partial.candidateStrengths ?? [],
      candidateWeaknesses: partial.candidateWeaknesses ?? [],
      answerScores: partial.answerScores ?? [],
      questionTopics: partial.questionTopics ?? [],
      lastAnswerScore: partial.lastAnswerScore ?? null,
      lastFollowUp: partial.lastFollowUp ?? null,
      interviewSummary: partial.interviewSummary ?? null,
      candidateName: partial.candidateName || 'Candidate',
      resumeSummary: partial.resumeSummary || '',
      firstQuestionPending: partial.firstQuestionPending ?? false,
    }
  }

  async save(memory: ConversationMemory): Promise<void> {
    await this.redis.set(this.key(memory.sessionId), JSON.stringify({ ...memory, updatedAt: new Date().toISOString() }), 'EX', this.ttlSeconds)
  }

  async clear(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId))
  }

  async countActive(): Promise<number> {
    const keys = await this.redis.keys(this.keyPattern())
    return keys.length
  }

  async init(input: {
    sessionId: string
    userId: string
    role: string
    company: string
    difficulty: string
  }): Promise<ConversationMemory> {
    const memory: ConversationMemory = {
      ...input,
      lifecycle: 'connecting',
      questionIndex: 0,
      askedQuestions: [],
      topics: [],
      recentTranscript: [],
      interviewInitialized: false,
      interviewStage: 'INTRODUCTION',
      interviewPlan: generateInterviewPlan(input.difficulty),
      planProgress: createEmptyPlanProgress(),
      candidateProfile: null,
      coveredTopics: [],
      weakTopics: [],
      strongTopics: [],
      candidateStrengths: [],
      candidateWeaknesses: [],
      answerScores: [],
      questionTopics: [],
      lastAnswerScore: null,
      lastFollowUp: null,
      interviewSummary: null,
      candidateName: 'Candidate',
      resumeSummary: '',
      firstQuestionPending: true,
      updatedAt: new Date().toISOString(),
    }
    await this.save(memory)
    return memory
  }

  async setLifecycle(sessionId: string, lifecycle: ConversationLifecycle): Promise<ConversationMemory | null> {
    const memory = await this.get(sessionId)
    if (!memory) return null
    memory.lifecycle = lifecycle
    await this.save(memory)
    return memory
  }

  async appendTranscript(
    sessionId: string,
    entry: { speaker: string; content: string; isFinal?: boolean },
  ): Promise<ConversationMemory | null> {
    const memory = await this.get(sessionId)
    if (!memory) return null
    memory.recentTranscript = [...memory.recentTranscript.slice(-40), { ...entry, at: new Date().toISOString() }]
    if (entry.isFinal && entry.speaker === 'candidate') {
      const topic = entry.content.slice(0, 80).trim()
      if (topic && !memory.topics.includes(topic)) memory.topics.push(topic)
    }
    await this.save(memory)
    return memory
  }

  async recordHeartbeat(
    sessionId: string,
    payload: { connectionHealth: string; transportReady: boolean; lifecycle?: string },
  ): Promise<ConversationMemory | null> {
    const memory = await this.get(sessionId)
    if (!memory) return null
    memory.lastHeartbeat = new Date().toISOString()
    memory.connectionHealth = payload.connectionHealth
    memory.transportReady = payload.transportReady
    await this.save(memory)
    return memory
  }

  async recordAskedQuestion(sessionId: string, question: string): Promise<void> {
    const memory = await this.get(sessionId)
    if (!memory || !question.trim()) return
    const normalized = question.trim()
    if (!memory.askedQuestions.includes(normalized)) {
      memory.askedQuestions.push(normalized)
      memory.questionIndex += 1
      await this.save(memory)
    }
  }
}
