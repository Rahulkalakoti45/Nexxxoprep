export interface ScoreInput {
  domain: string
  scoreType: string
  value: number
  weight?: number | undefined
  metadata?: Record<string, unknown> | undefined
}

export interface ReportGenerationInput {
  sessionId: string
  userId: string
  summary: string
  scores: ScoreInput[]
  aiFeedback: Record<string, unknown>
  behavioralSummary?: Record<string, unknown>
  roadmapSuggestions: RoadmapSuggestionInput[]
}

export interface RoadmapSuggestionInput {
  category: string
  priority: number
  title: string
  description: string
  actions: string[]
  dueAfterDays?: number | undefined
}

export interface PersistedReport {
  id: string
  sessionId: string
  userId: string
  overallScore: number
  technicalScore: number
  communicationScore: number
  confidenceScore: number
  hesitationScore: number
  behavioralScore: number
  summary: string
  createdAt: string
}

export interface AnalyticsSnapshot {
  userId: string
  interviewCount: number
  averageOverallScore: number
  averageTechnicalScore: number
  averageCommunicationScore: number
  weakAreas: Array<{ domain: string; averageScore: number }>
  performanceTrend: Array<{ sessionId: string; completedAt: string; score: number }>
  emotionalMetrics: Record<string, number>
  communicationMetrics: Record<string, number>
}
