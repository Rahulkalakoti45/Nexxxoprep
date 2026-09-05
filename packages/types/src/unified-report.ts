export type UnifiedReportReadinessStatus = 'ready' | 'pending' | 'unavailable'

export interface UnifiedReportResumeSection {
  status: UnifiedReportReadinessStatus
  resumeScore: number | null
  atsScore: number | null
  extractedSkills: unknown
  missingSkills: unknown
  suggestions: unknown
  createdAt: string | null
}

export interface UnifiedReportInterviewSection {
  status: UnifiedReportReadinessStatus
  overallScore: number | null
  technicalScore: number | null
  communicationScore: number | null
  confidenceScore: number | null
  hesitationScore: number | null
  behavioralScore: number | null
  summary: string | null
  createdAt: string | null
}

export interface UnifiedReportBehaviorSection {
  status: UnifiedReportReadinessStatus
  behaviorScore: number | null
  engagementScore: number | null
  attentionScore: number | null
  warningCount: number | null
  // Where the numeric values above came from: a fresh read of report.json,
  // or the cached values recorded on InterviewSession.metadata.behaviorReport
  // when report.json could not be opened. Null when there is no behavior
  // report pointer at all.
  source: 'report.json' | 'cached_metadata' | null
}

export interface UnifiedReportConversationSection {
  status: UnifiedReportReadinessStatus
  transcriptSummary: string | null
  transcriptCount: number
}

export interface UnifiedReportCompositeScore {
  resumeScore: number | null
  interviewOverallScore: number | null
  behaviorScore: number | null
  // Placeholder only — Phase 4C never computes a weighted composite.
  computed: false
}

export interface UnifiedReportResponse {
  sessionId: string
  userId: string
  sessionStatus: string
  resume: UnifiedReportResumeSection
  interview: UnifiedReportInterviewSection
  behavior: UnifiedReportBehaviorSection
  conversation: UnifiedReportConversationSection
  composite: UnifiedReportCompositeScore
  generatedAt: string
}
