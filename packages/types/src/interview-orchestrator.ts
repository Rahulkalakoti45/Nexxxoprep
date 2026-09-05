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

export interface InterviewSummary {
  strengths: string[]
  weaknesses: string[]
  keyTopics: string[]
  recommendations: string[]
  overallRating: number
  generatedAt: string
}

export interface FollowUpDirective {
  quality: AnswerQuality
  instruction: string
  depth: 'clarify' | 'standard' | 'deep'
}
