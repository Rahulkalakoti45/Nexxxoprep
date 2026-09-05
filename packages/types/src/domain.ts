export type InterviewMode = 'standard' | 'ai_simulated' | 'voice_realtime'
export type SessionStatus = 'created' | 'active' | 'paused' | 'completed' | 'abandoned' | 'failed'
export type RoundStatus = 'pending' | 'active' | 'completed' | 'skipped'
export type TranscriptSpeaker = 'candidate' | 'interviewer' | 'system' | 'ai'
export type EventSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical'

export interface UserProfile {
  id: string
  email: string
  name: string
  college?: string | null | undefined
  branch?: string | null | undefined
  graduationYear?: number | null | undefined
  targetRole?: string | null | undefined
  experienceLevel?: string | null | undefined
}

export interface InterviewSessionSummary {
  id: string
  userId: string
  mode: InterviewMode
  status: SessionStatus
  role: string
  company: string
  difficulty: string
  startedAt: Date | null
  completedAt: Date | null
  durationSeconds: number
}

export interface ActiveSessionState {
  sessionId: string
  userId: string
  status: SessionStatus
  currentRoundId?: string | undefined
  currentQuestionId?: string | undefined
  activeSpeaker?: TranscriptSpeaker | undefined
  lastTranscriptText?: string | undefined
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface TranscriptEntryInput {
  sessionId: string
  roundId?: string | undefined
  speaker: TranscriptSpeaker
  content: string
  sequence: number
  startedAt?: Date | undefined
  endedAt?: Date | undefined
  confidence?: number | undefined
  metadata?: Record<string, unknown> | undefined
}

export interface BehaviorMetricInput {
  sessionId: string
  metricType: string
  value: number
  confidence?: number | undefined
  source: string
  capturedAt?: Date | undefined
  metadata?: Record<string, unknown> | undefined
}

export interface EmotionStateInput {
  sessionId: string
  emotion: string
  intensity: number
  confidence?: number | undefined
  source: string
  capturedAt?: Date | undefined
  metadata?: Record<string, unknown> | undefined
}
