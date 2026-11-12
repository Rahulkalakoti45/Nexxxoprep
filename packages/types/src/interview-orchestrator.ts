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

export type AnswerVerdict = 'strong' | 'okay' | 'weak'

/**
 * Coaching for one answered question. `sequence` points at the question in
 * evidence.questionsAnswered, and `quote` is only kept when it appears word
 * for word in the candidate's answer, so every comment can be checked.
 */
export interface QuestionFeedback {
  sequence: number
  topic: string
  verdict: AnswerVerdict
  quote: string | null
  whatWorked: string
  whatWasMissing: string
  betterAnswer: string
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
  questionFeedback?: QuestionFeedback[]
}

/** A weak area carried over from earlier practice sessions into the next interview. */
export interface PracticeFocusArea {
  topic: string
  /** How many earlier sessions flagged it. */
  timesFlagged: number
  /** The most recent 0-10 score for it, when one was given. */
  lastScore: number | null
}

export type WeakSpotTrend = 'improving' | 'still_weak' | 'resolved' | 'new'

export interface ProgressWeakSpot {
  topic: string
  trend: WeakSpotTrend
  /** Oldest first: the 0-10 score in each session where the topic was scored. */
  scores: Array<{ sessionId: string; score: number }>
}

export interface PracticeProgress {
  sessionCount: number
  sessions: Array<{
    sessionId: string
    completedAt: string
    role: string
    company: string
    overallScore: number
    technical: number | null
    communication: number | null
    confidence: number | null
  }>
  weakSpots: ProgressWeakSpot[]
  nextFocus: PracticeFocusArea[]
}

export interface FollowUpDirective {
  quality: AnswerQuality
  instruction: string
  depth: 'clarify' | 'standard' | 'deep'
}
