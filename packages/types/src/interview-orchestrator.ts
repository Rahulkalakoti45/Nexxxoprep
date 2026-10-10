export type InterviewStage =
  | 'INTRODUCTION'
  | 'RESUME_DISCUSSION'
  | 'TECHNICAL_ROUND'
  | 'DEEP_TECHNICAL'
  | 'BEHAVIORAL_ROUND'
  | 'HR_ROUND'
  | 'SUMMARY'
  | 'COMPLETED'

export type AnswerQuality = 'WEAK' | 'AVERAGE' | 'STRONG'

export interface InterviewPlan {
  resumeQuestions: number
  technicalQuestions: number
  behavioralQuestions: number
  hrQuestions: number
}

export interface InterviewPlanProgress {
  introduction: number
  resume: number
  technical: number
  deepTechnical: number
  behavioral: number
  hr: number
  summary: number
}

export interface CandidateProfile {
  skills: string[]
  projects: string[]
  experience: string[]
  education: string[]
  technologies: string[]
}

export interface AnswerScore {
  technicalDepth: number
  communication: number
  clarity: number
  completeness: number
  confidence: number
  quality: AnswerQuality
  average: number
  scoredAt: string
  answerPreview: string
}

/** 0-10 ratings written from the transcript when per-answer scoring did not run during the interview. */
export interface SummaryDimensionScores {
  technical: number
  communication: number
  confidence: number
}

/** The answered questions grouped by topic, with a 0-10 score for each group. */
export interface SummaryDomainScore {
  domain: string
  score: number
  questions: number
}

export interface InterviewSummary {
  strengths: string[]
  weaknesses: string[]
  keyTopics: string[]
  recommendations: string[]
  overallRating: number
  generatedAt: string
  dimensionScores?: SummaryDimensionScores
  domainScores?: SummaryDomainScore[]
}

export interface FollowUpDirective {
  quality: AnswerQuality
  instruction: string
  depth: 'clarify' | 'standard' | 'deep'
}
