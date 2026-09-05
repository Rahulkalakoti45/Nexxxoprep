import type { AnswerQuality, AnswerScore, CandidateProfile, InterviewPlan, InterviewPlanProgress } from './interview-orchestrator.js'
import type { InterviewMode, SessionStatus, TranscriptSpeaker } from './domain.js'

/**
 * Structured, deterministic evidence extracted from a single interview session.
 *
 * This object is produced by EvidenceExtractionService and is intended to be
 * the ONLY source of truth for downstream report / analytics generation.
 * Every field must be traceable back to: the persisted transcript, stored
 * interview metadata, stored answer scores, or the candidate's resume record.
 * Nothing in this shape should ever be inferred or fabricated beyond
 * straightforward, deterministic aggregation of that stored data.
 */

export type EvidenceSource = 'transcript_table' | 'redis_recent_transcript' | 'none'

export interface EvidenceTranscriptEntry {
  sequence: number
  speaker: TranscriptSpeaker
  content: string
  at: string | null
}

export interface EvidenceQAPair {
  sequence: number
  question: string
  askedAt: string | null
  answer: string | null
  answeredAt: string | null
}

export interface InterviewMetadataEvidence {
  sessionId: string
  userId: string
  role: string
  company: string
  difficulty: string
  mode: InterviewMode | null
  status: SessionStatus | null
  candidateName: string
  interviewStage: string
  startedAt: string | null
  completedAt: string | null
  durationSeconds: number | null
}

export interface TranscriptStatistics {
  source: EvidenceSource
  totalEntries: number
  candidateEntries: number
  interviewerEntries: number
  systemEntries: number
  candidateWordCount: number
  interviewerWordCount: number
  averageCandidateAnswerWordCount: number
  longestCandidateAnswerWordCount: number
  shortestCandidateAnswerWordCount: number
  firstEntryAt: string | null
  lastEntryAt: string | null
}

export interface CommunicationEvidenceEntry {
  sequence: number
  wordCount: number
  fillerWordCount: number
  sentenceCount: number
  preview: string
}

export interface TechnicalTopicsEvidence {
  covered: string[]
  strong: string[]
  weak: string[]
  questionTopics: string[]
}

export interface ResumeContextEvidence {
  candidateProfile: CandidateProfile | null
  resumeSummary: string
  atsScore: number | null
  resumeScore: number | null
  extractedSkills: string[]
  missingSkills: string[]
}

export interface ConfidenceSignalEntry {
  scoredAt: string
  answerPreview: string
  quality: AnswerQuality
  technicalDepth: number
  communication: number
  clarity: number
  completeness: number
  confidence: number
  average: number
}

export interface ConfidenceSignals {
  scoreCount: number
  averageTechnicalDepth: number | null
  averageCommunication: number | null
  averageClarity: number | null
  averageCompleteness: number | null
  averageConfidence: number | null
  averageOverall: number | null
  qualityDistribution: Record<AnswerQuality, number>
  perAnswer: ConfidenceSignalEntry[]
}

export interface CoverageMetrics {
  interviewPlan: InterviewPlan
  planProgress: InterviewPlanProgress
  questionsAskedTotal: number
  questionIndex: number
}

export interface InterviewEvidence {
  interviewMetadata: InterviewMetadataEvidence
  transcriptStatistics: TranscriptStatistics
  questionsAsked: string[]
  questionsAnswered: EvidenceQAPair[]
  technicalTopics: TechnicalTopicsEvidence
  communicationEvidence: CommunicationEvidenceEntry[]
  strengthsObserved: string[]
  weaknessesObserved: string[]
  unansweredQuestions: string[]
  resumeContext: ResumeContextEvidence
  confidenceSignals: ConfidenceSignals
  coverageMetrics: CoverageMetrics
  extractionNotes: string[]
  extractedAt: string
}
