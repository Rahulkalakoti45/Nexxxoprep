import { z } from 'zod'

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
})

export const userIdParamSchema = z.object({
  userId: z.string().min(1),
})

export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1),
})

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(160),
  college: z.string().max(160).optional(),
  branch: z.string().max(120).optional(),
  graduationYear: z.number().int().min(1950).max(2150).optional(),
  targetRole: z.string().max(120).optional(),
  experienceLevel: z.string().max(80).optional(),
})

export const createSessionSchema = z.object({
  userId: z.string().min(1),
  role: z.string().min(1).max(120),
  company: z.string().min(1).max(120),
  difficulty: z.string().min(1).max(80),
  mode: z.enum(['standard', 'ai_simulated', 'voice_realtime']).default('standard'),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const updateSessionStateSchema = z.object({
  status: z.enum(['created', 'active', 'paused', 'completed', 'abandoned', 'failed']).optional(),
  currentRoundId: z.string().optional(),
  currentQuestionId: z.string().optional(),
  activeSpeaker: z.enum(['candidate', 'interviewer', 'system', 'ai']).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const appendTranscriptSchema = z.object({
  roundId: z.string().optional(),
  speaker: z.enum(['candidate', 'interviewer', 'system', 'ai']),
  content: z.string().min(1),
  sequence: z.number().int().min(0),
  startedAt: z.coerce.date().optional(),
  endedAt: z.coerce.date().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const scoreInputSchema = z.object({
  domain: z.string().min(1),
  scoreType: z.string().min(1),
  value: z.number().min(0).max(100),
  weight: z.number().min(0).max(1).default(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const roadmapSuggestionSchema = z.object({
  category: z.string().min(1),
  priority: z.number().int().min(1).max(5),
  title: z.string().min(1),
  description: z.string().min(1),
  actions: z.array(z.string().min(1)),
  dueAfterDays: z.number().int().positive().optional(),
})

export const generateReportSchema = z.object({
  userId: z.string().min(1),
  summary: z.string().min(1),
  scores: z.array(scoreInputSchema).min(1),
  aiFeedback: z.record(z.string(), z.unknown()).default({}),
  behavioralSummary: z.record(z.string(), z.unknown()).default({}),
  roadmapSuggestions: z.array(roadmapSuggestionSchema).default([]),
})

export function parseWithSchema<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    throw new Error(JSON.stringify(issues))
  }
  return result.data
}
