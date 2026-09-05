import { toPrismaJson, type DatabaseClient } from '@nexoprep/database'
import type { AnswerScore, CandidateProfile, FollowUpDirective, InterviewStage } from '@nexoprep/types'
import type { ConversationMemory, ConversationMemoryService } from '../conversation/memory.service.js'
import { AnswerScoringService } from './answer-scoring.service.js'
import { CandidateProfileService } from './candidate-profile.service.js'
import {
  advanceStageIfNeeded,
  getStageObjective,
  incrementStageProgress,
  isStageComplete,
  nextStage,
} from './interview-stages.js'
import { createEmptyPlanProgress, generateInterviewPlan } from './interview-plan.service.js'
import { InterviewSummaryService } from './interview-summary.service.js'
import { buildPromptContextSnapshot } from './prompts/interviewer.prompt.js'
import { QuestionDiversityService } from './question-diversity.service.js'
import type { ReportService } from '@nexoprep/report-service'
import type { EvidenceExtractionService } from '../evidence/evidence-extraction.service.js'

export interface InterviewContextInput {
  userId: string
  role: string
  company: string
  difficulty: string
  candidateName?: string
  resumeText?: string
  resumeSummary?: string
}

export class InterviewEngineService {
  constructor(
    private readonly memoryService: ConversationMemoryService,
    private readonly candidateProfileService: CandidateProfileService,
    private readonly answerScoringService: AnswerScoringService,
    private readonly questionDiversityService: QuestionDiversityService,
    private readonly interviewSummaryService: InterviewSummaryService,
    private readonly reportService: ReportService,
    private readonly prisma: DatabaseClient,
    private readonly evidenceExtractionService: EvidenceExtractionService,
  ) {}

  async initializeInterview(
    sessionId: string,
    input: InterviewContextInput,
    profile?: CandidateProfile | null,
  ): Promise<ConversationMemory | null> {
    return this.syncInterviewContext(sessionId, input, profile, { forceInit: true })
  }

  async syncInterviewContext(
    sessionId: string,
    input: Partial<InterviewContextInput>,
    profile?: CandidateProfile | null,
    options: { forceInit?: boolean } = {},
  ): Promise<ConversationMemory | null> {
    const memory = await this.memoryService.get(sessionId)
    if (!memory) return null

    memory.role = input.role || memory.role
    memory.company = input.company || memory.company
    memory.difficulty = input.difficulty || memory.difficulty
    memory.candidateName = input.candidateName || memory.candidateName || 'Candidate'

    if (profile) {
      memory.candidateProfile = this.mergeProfiles(memory.candidateProfile, profile)
    }

    if (input.resumeText?.trim()) {
      const fromText = this.candidateProfileService.fromResumeText(
        input.resumeText,
        memory.candidateProfile?.skills || [],
      )
      memory.candidateProfile = this.mergeProfiles(memory.candidateProfile, fromText)
      memory.resumeSummary = input.resumeSummary || this.buildResumeSummary(input.resumeText, memory.candidateProfile)
    } else if (input.resumeSummary) {
      memory.resumeSummary = input.resumeSummary
    }

    const firstInit = !memory.interviewInitialized
    if (firstInit || options.forceInit) {
      if (firstInit) {
        memory.interviewInitialized = true
        memory.interviewStage = 'INTRODUCTION'
        memory.interviewPlan = generateInterviewPlan(memory.difficulty)
        memory.planProgress = createEmptyPlanProgress()
        memory.weakTopics = memory.weakTopics || []
        memory.strongTopics = memory.strongTopics || []
        memory.candidateStrengths = memory.candidateStrengths || []
        memory.candidateWeaknesses = memory.candidateWeaknesses || []
        memory.answerScores = memory.answerScores || []
        memory.questionTopics = memory.questionTopics || []
        memory.lastAnswerScore = null
        memory.lastFollowUp = null
        memory.interviewSummary = null
      }
    }

    memory.firstQuestionPending = memory.askedQuestions.length === 0 && this.hasResumeData(memory)

    if (firstInit) {
      console.log('[INTERVIEW_INIT:profile]', {
        sessionId,
        company: memory.company,
        role: memory.role,
        difficulty: memory.difficulty,
        candidateName: memory.candidateName,
        skills: memory.candidateProfile?.skills || [],
        projects: memory.candidateProfile?.projects || [],
        experience: memory.candidateProfile?.experience || [],
        technologies: memory.candidateProfile?.technologies || [],
        resumeSummaryLength: memory.resumeSummary?.length || 0,
      })
    }

    await this.memoryService.save(memory)

    if (firstInit) {
      await this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          metadata: toPrismaJson({
            interviewStage: memory.interviewStage,
            interviewPlan: memory.interviewPlan,
            candidateProfile: memory.candidateProfile,
            company: memory.company,
            role: memory.role,
            difficulty: memory.difficulty,
          }),
        },
      }).catch(() => undefined)
    }

    return memory
  }

  async ensureContextFromDatabase(sessionId: string): Promise<ConversationMemory | null> {
    const memory = await this.memoryService.get(sessionId)
    if (!memory) return null

    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    })
    if (!session) return memory

    const resumeRecord = await this.prisma.resumeAnalysis.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    })

    const profile = resumeRecord
      ? this.candidateProfileService.fromResumeAnalysis(resumeRecord)
      : memory.candidateProfile

    const raw = (resumeRecord?.rawAnalysis || {}) as Record<string, unknown>
    const resumeSnippet = typeof raw.resumeSnippet === 'string' ? raw.resumeSnippet : undefined

    return this.syncInterviewContext(
      sessionId,
      {
        userId: session.userId,
        role: session.role,
        company: session.company,
        difficulty: session.difficulty,
        ...(session.user?.name ? { candidateName: session.user.name } : {}),
        ...(resumeSnippet ? { resumeText: resumeSnippet } : {}),
      },
      profile,
    )
  }

  logContextBeforeGemini(sessionId: string, memory: ConversationMemory): void {
    console.log('[GEMINI_CONTEXT]', {
      sessionId,
      company: memory.company,
      role: memory.role,
      difficulty: memory.difficulty,
      candidateName: memory.candidateName,
      interviewStage: memory.interviewStage,
      candidateProfile: memory.candidateProfile,
      resumeSummaryPreview: memory.resumeSummary?.slice(0, 200) || null,
      firstQuestionPending: memory.firstQuestionPending,
    })
  }

  async processCandidateAnswer(sessionId: string, answer: string): Promise<ConversationMemory | null> {
    let memory = await this.ensureContextFromDatabase(sessionId)
    if (!memory || !answer.trim()) return memory

    const score = this.answerScoringService.scoreAnswer(answer, {
      role: memory.role,
      stage: memory.interviewStage,
      lastQuestion: memory.askedQuestions[memory.askedQuestions.length - 1] || null,
    })

    memory.lastAnswerScore = score
    memory.answerScores = [...memory.answerScores.slice(-19), score]
    memory.lastFollowUp = this.answerScoringService.buildFollowUpDirective(
      score,
      memory.coveredTopics[memory.coveredTopics.length - 1],
    )

    const topic = this.questionDiversityService.extractTopic(answer)
    if (topic && !memory.coveredTopics.includes(topic)) {
      memory.coveredTopics.push(topic)
    }

    if (score.quality === 'WEAK') {
      if (topic && !memory.weakTopics.includes(topic)) memory.weakTopics.push(topic)
      if (!memory.candidateWeaknesses.includes(score.answerPreview)) {
        memory.candidateWeaknesses.push(score.answerPreview)
      }
    } else if (score.quality === 'STRONG') {
      if (topic && !memory.strongTopics.includes(topic)) memory.strongTopics.push(topic)
      if (!memory.candidateStrengths.includes(topic || score.answerPreview)) {
        memory.candidateStrengths.push(topic || score.answerPreview)
      }
    }

    await this.memoryService.save(memory)
    await this.persistAnswerScores(sessionId, score)
    return memory
  }

  async recordInterviewerQuestion(sessionId: string, question: string): Promise<ConversationMemory | null> {
    const memory = await this.memoryService.get(sessionId)
    if (!memory || !question.trim()) return memory

    if (this.questionDiversityService.isDuplicateQuestion(question, memory.askedQuestions)) {
      return memory
    }

    this.questionDiversityService.registerQuestion(question, memory)
    memory.questionIndex += 1
    memory.firstQuestionPending = false
    memory.planProgress = incrementStageProgress(memory.interviewStage, memory.planProgress)

    const advanced = advanceStageIfNeeded(memory.interviewStage, memory.interviewPlan, memory.planProgress)
    memory.interviewStage = advanced.stage
    memory.planProgress = advanced.progress

    if (memory.interviewStage === 'COMPLETED') {
      memory.lifecycle = 'completed'
    }

    await this.memoryService.save(memory)
    return memory
  }

  getFollowUpDirective(memory: ConversationMemory): FollowUpDirective | null {
    return memory.lastFollowUp
  }

  shouldAdvanceStage(memory: ConversationMemory): boolean {
    return isStageComplete(memory.interviewStage, memory.interviewPlan, memory.planProgress)
  }

  getNextStageHint(memory: ConversationMemory): string {
    if (!this.shouldAdvanceStage(memory)) {
      return getStageObjective(memory.interviewStage)
    }
    const upcoming = nextStage(memory.interviewStage)
    return `Current stage quota met. Transition naturally to ${upcoming}: ${getStageObjective(upcoming)}`
  }

  async finalizeInterview(sessionId: string, userId: string): Promise<ConversationMemory | null> {
    const memory = await this.memoryService.get(sessionId)
    if (!memory) return null

    memory.interviewStage = 'COMPLETED'

    let evidence: Awaited<ReturnType<EvidenceExtractionService['extractAndPersist']>> | null = null
    try {
      evidence = await this.evidenceExtractionService.extractAndPersist(sessionId, memory)
      console.log('[EVIDENCE] extraction complete', {
        sessionId,
        transcriptSource: evidence.transcriptStatistics.source,
        totalEntries: evidence.transcriptStatistics.totalEntries,
        questionsAsked: evidence.questionsAsked.length,
        unansweredQuestions: evidence.unansweredQuestions.length,
        notes: evidence.extractionNotes,
      })
    } catch (err) {
      console.error('[EVIDENCE] extraction failed', err)
    }

    // The structured `evidence` object above is now the source of truth passed into
    // InterviewSummaryService/Gemini — it is also persisted onto InterviewSession.metadata
    // so later phases can read it back without re-deriving anything from the raw transcript.
    const summary = await this.interviewSummaryService.generateSummary(memory, evidence)
    memory.interviewSummary = summary

    const reportPayload = this.interviewSummaryService.toReportPayload(summary, memory.answerScores)
    try {
  console.log("[REPORT] generateAndStoreReport START", {
    sessionId,
    userId,
  });

  const report = await this.reportService.generateAndStoreReport({
    sessionId,
    userId,
    summary: reportPayload.summary,
    aiFeedback: reportPayload.aiFeedback,
    behavioralSummary: reportPayload.behavioralSummary,
    scores: reportPayload.scores,
    roadmapSuggestions: summary.recommendations.map((rec, index) => ({
      category: "interview",
      priority: index + 1,
      title: "Interview improvement",
      description: rec,
      actions: [rec],
    })),
  });

  console.log("[REPORT] SUCCESS", report?.sessionId);
} catch (err) {
  console.error("[REPORT] FAILED");
  console.error(err);
  throw err;
}
    
    await this.memoryService.save(memory)
    return memory
  }

  getDebugSnapshot(memory: ConversationMemory) {
    const currentPromptContext = buildPromptContextSnapshot(memory)
    return {
      company: memory.company,
      role: memory.role,
      difficulty: memory.difficulty,
      candidateName: memory.candidateName,
      candidateProfile: memory.candidateProfile,
      resumeSummary: memory.resumeSummary,
      currentPromptContext,
      currentStage: memory.interviewStage,
      questionCount: memory.questionIndex,
      planProgress: memory.planProgress,
      interviewPlan: memory.interviewPlan,
      answerScores: memory.answerScores.slice(-5),
      strongTopics: memory.strongTopics,
      weakTopics: memory.weakTopics,
      lastAnswerScore: memory.lastAnswerScore,
      coveredTopics: memory.coveredTopics.slice(-8),
      firstQuestionPending: memory.firstQuestionPending,
    }
  }

  private hasResumeData(memory: ConversationMemory): boolean {
    const p = memory.candidateProfile
    return Boolean(p && (p.skills.length > 0 || p.projects.length > 0 || p.experience.length > 0))
  }

  private buildResumeSummary(resumeText: string, profile: CandidateProfile | null): string {
    const trimmed = resumeText.replace(/\s+/g, ' ').trim()
    const headline = trimmed.slice(0, 400)
    const skills = profile?.skills?.slice(0, 8).join(', ') || ''
    return [headline, skills ? `Key skills: ${skills}` : ''].filter(Boolean).join(' | ')
  }

  private mergeProfiles(
    existing: CandidateProfile | null,
    incoming: CandidateProfile | null,
  ): CandidateProfile | null {
    if (!incoming) return existing
    if (!existing) return incoming
    return {
      skills: this.uniqueStrings([...existing.skills, ...incoming.skills]),
      projects: this.uniqueStrings([...existing.projects, ...incoming.projects]),
      experience: this.uniqueStrings([...existing.experience, ...incoming.experience]),
      education: this.uniqueStrings([...existing.education, ...incoming.education]),
      technologies: this.uniqueStrings([...existing.technologies, ...incoming.technologies]),
    }
  }

  private uniqueStrings(items: string[]): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of items) {
      const key = item.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(item)
      }
    }
    return out
  }

  private async persistAnswerScores(sessionId: string, score: AnswerScore): Promise<void> {
    const rows = [
      { domain: 'technical', scoreType: 'technical_depth', value: score.technicalDepth },
      { domain: 'communication', scoreType: 'communication', value: score.communication },
      { domain: 'communication', scoreType: 'clarity', value: score.clarity },
      { domain: 'technical', scoreType: 'completeness', value: score.completeness },
      { domain: 'confidence', scoreType: 'confidence', value: score.confidence },
      { domain: 'overall', scoreType: 'answer_average', value: score.average },
    ]

    await this.prisma.score.createMany({
      data: rows.map((row) => ({
        sessionId,
        domain: row.domain,
        scoreType: row.scoreType,
        value: row.value,
        weight: 1,
        metadata: toPrismaJson({
          quality: score.quality,
          answerPreview: score.answerPreview,
          scoredAt: score.scoredAt,
        }),
      })),
    }).catch(() => undefined)
  }
}

export type { InterviewStage }
