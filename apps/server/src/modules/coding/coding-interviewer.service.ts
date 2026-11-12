import { AppError } from '@nexoprep/shared'
import type { GeminiService } from '../orchestrator/gemini.service.js'
import { clampScore, parseJsonObject } from '../orchestrator/interview-summary.service.js'

export type CodingStage = 'approach' | 'coding' | 'wrapup'
export type CodingEvent = 'start' | 'message' | 'run' | 'hint' | 'submit'

export interface CodingProblemContext {
  title: string
  difficulty: string
  prompt: string
  expectedComplexity: { time: string; space: string }
  followUps: string[]
}

export interface CodingRunSummary {
  passed: number
  total: number
  hiddenPassed?: number | undefined
  hiddenTotal?: number | undefined
  compileError?: string | null | undefined
  timedOut?: boolean | undefined
  failures: Array<{
    label?: string | null | undefined
    input?: string | null | undefined
    expected?: string | null | undefined
    actual?: string | null | undefined
    error?: string | null | undefined
    hidden?: boolean | undefined
  }>
}

export interface CodingMessage {
  role: 'interviewer' | 'candidate'
  content: string
}

export interface CodingTurnInput {
  problem: CodingProblemContext
  stage: CodingStage
  event: CodingEvent
  language: string
  code: string
  messages: CodingMessage[]
  lastRun?: CodingRunSummary | null | undefined
  hint?: string | null | undefined
}

export interface CodingTurnReply {
  reply: string
  readyToCode: boolean
}

export interface CodingEvaluationInput {
  problem: CodingProblemContext
  language: string
  code: string
  messages: CodingMessage[]
  finalRun: CodingRunSummary
  hintsUsed: number
  durationSeconds: number
}

export interface CodingEvaluation {
  scores: { correctness: number; efficiency: number; codeQuality: number; communication: number }
  overall: number
  verdict: 'strong' | 'okay' | 'weak'
  complexity: { stated: string | null; estimatedTime: string | null; estimatedSpace: string | null; isOptimal: boolean | null }
  strengths: string[]
  improvements: string[]
  codeComments: Array<{ snippet: string; comment: string }>
  optimalApproach: string
  hintPenalty: number
  generatedBy: 'gemini'
}

const TURN_SYSTEM_PROMPT = `You are a senior software engineer running a live coding interview. You are warm, concise and realistic.

Hard rules:
- NEVER write solution code, pseudo-code that solves the problem, or the full algorithm. The candidate must solve it.
- Reply in 1-3 short sentences, as you would speak. Ask at most ONE question.
- Only answer clarifying questions with facts already in the problem statement. If something isn't specified, say what assumption is reasonable.
- Refer to the candidate's own words and code. Never invent what they said or wrote.

How to behave by stage and event:
- start: greet briefly, then ask them to talk through their approach before writing code.
- stage "approach": probe their idea (time/space complexity, an edge case). When the approach would work (it need not be optimal), set readyToCode=true and tell them to go ahead and code it. If it is brute force, you may ask once whether they can do better before letting them code.
- event "run": react to the test results. If something fails, point them at the TYPE of failing case (e.g. "an empty input", "the large test timed out") and ask what they think is happening. Do not tell them the fix. If everything passed, ask about complexity or an untested edge case.
- event "hint": the HINT text is provided. Deliver that hint conversationally and do not go beyond it.
- event "submit" / stage "wrapup": ask them to state the final time and space complexity and how they would test it further, or ask one of the follow-up questions.

Return ONLY JSON: {"reply": string, "readyToCode": boolean}`

const EVALUATION_SYSTEM_PROMPT = `You are a senior engineer writing feedback on a candidate's coding interview.

Use ONLY the supplied problem, code, test results and conversation. Never invent things the candidate said or wrote.
Scores are 0-100 integers:
- efficiency: how close the solution's time and space complexity is to the expected optimum. A solution that is correct but asymptotically slower than expected cannot score above 60.
- codeQuality: readability, naming, structure, handling of edge cases in the code.
- communication: how clearly the candidate explained their approach and complexity in the conversation. If they barely spoke, score low.
Do NOT score correctness; it is computed from the tests.

codeComments: up to 4 items. Each "snippet" must be copied EXACTLY from the candidate's code (one line or a short fragment) and "comment" says what to improve or what is good about it.
optimalApproach: 2-4 sentences describing the optimal approach in words (no code). This is shown after the interview, for learning.

Return ONLY JSON with keys: efficiency, codeQuality, communication (numbers), statedComplexity (string or null: what the candidate claimed, quoted from the conversation), estimatedTime (string), estimatedSpace (string), isOptimal (boolean), strengths (string[] max 3), improvements (string[] max 3), codeComments (array of {"snippet": string, "comment": string}), optimalApproach (string).`

/** Removes fenced code blocks: the interviewer must never hand over a solution. */
export function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/```[\s\S]*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function lastMessages(messages: CodingMessage[], count = 14): string {
  return messages
    .slice(-count)
    .map((m) => `${m.role === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE'}: ${m.content.slice(0, 800)}`)
    .join('\n')
}

function describeRun(run: CodingRunSummary | null | undefined): string {
  if (!run) return 'Not run yet.'
  if (run.compileError) return `Code did not run: ${run.compileError}`
  const lines = [`Passed ${run.passed}/${run.total} tests${run.timedOut ? ' (time limit exceeded)' : ''}.`]
  for (const f of run.failures.slice(0, 4)) {
    lines.push(
      f.hidden
        ? `- Hidden test failed${f.label ? ` (${f.label})` : ''}${f.error ? `: ${f.error}` : ''}`
        : `- Failed: input ${f.input} expected ${f.expected} got ${f.error ? `error ${f.error}` : f.actual}`,
    )
  }
  return lines.join('\n')
}

export function buildTurnPrompt(input: CodingTurnInput): string {
  return [
    `PROBLEM: ${input.problem.title} (${input.problem.difficulty})`,
    input.problem.prompt.slice(0, 2000),
    `Expected optimal complexity (do not reveal unless they already reached it): time ${input.problem.expectedComplexity.time}, space ${input.problem.expectedComplexity.space}`,
    input.problem.followUps.length ? `Possible follow-ups: ${input.problem.followUps.join(' | ')}` : '',
    '',
    `STAGE: ${input.stage}   EVENT: ${input.event}   LANGUAGE: ${input.language}`,
    input.event === 'hint' && input.hint ? `HINT TO DELIVER: ${input.hint}` : '',
    '',
    `CANDIDATE'S CURRENT CODE:\n${input.code.slice(0, 6000) || '(empty)'}`,
    '',
    `LATEST TEST RUN:\n${describeRun(input.lastRun)}`,
    '',
    `CONVERSATION SO FAR:\n${lastMessages(input.messages) || '(none)'}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export function parseTurn(raw: string, input: Pick<CodingTurnInput, 'stage'>): CodingTurnReply {
  const parsed = parseJsonObject(raw)
  const reply = stripCode(typeof parsed.reply === 'string' ? parsed.reply : '').slice(0, 600)
  if (!reply) throw new Error('Interviewer reply was empty')
  return { reply, readyToCode: input.stage === 'approach' ? parsed.readyToCode === true : false }
}

function asStrings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().slice(0, 300))
    .slice(0, max)
}

const toHundred = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  // Accept either 0-10 or 0-100 from the model.
  const scaled = n <= 10 ? n * 10 : n
  return Math.round(Math.min(100, Math.max(0, scaled)))
}

/**
 * Turns the model's evaluation into the stored shape. Correctness and the hint penalty are
 * computed here from the test results, never taken from the model, and a code comment survives
 * only when its snippet really appears in the candidate's code.
 */
export function parseEvaluation(raw: string, input: CodingEvaluationInput): CodingEvaluation {
  const parsed = parseJsonObject(raw)
  const run = input.finalRun
  const correctness = run.total ? Math.round((run.passed / run.total) * 100) : 0

  let efficiency = toHundred(parsed.efficiency, 50)
  if (run.timedOut) efficiency = Math.min(efficiency, 40)
  const codeQuality = toHundred(parsed.codeQuality, 50)
  const communication = toHundred(parsed.communication, 40)

  const hintPenalty = Math.min(15, Math.max(0, input.hintsUsed) * 5)
  const overall = Math.max(0, Math.min(100, Math.round(0.4 * correctness + 0.2 * efficiency + 0.2 * codeQuality + 0.2 * communication) - hintPenalty))

  const compactCode = input.code.replace(/\s+/g, ' ')
  const codeComments: CodingEvaluation['codeComments'] = []
  if (Array.isArray(parsed.codeComments)) {
    for (const item of parsed.codeComments) {
      if (!item || typeof item !== 'object') continue
      const { snippet, comment } = item as Record<string, unknown>
      if (typeof snippet !== 'string' || typeof comment !== 'string') continue
      const s = snippet.trim()
      if (s.length < 3 || !compactCode.includes(s.replace(/\s+/g, ' '))) continue
      codeComments.push({ snippet: s.slice(0, 200), comment: comment.trim().slice(0, 300) })
      if (codeComments.length === 4) break
    }
  }

  const stated = typeof parsed.statedComplexity === 'string' && parsed.statedComplexity.trim() ? parsed.statedComplexity.trim().slice(0, 120) : null
  const clamped = clampScore(overall / 10) ?? 0

  return {
    scores: { correctness, efficiency, codeQuality, communication },
    overall,
    verdict: clamped >= 7.5 && correctness === 100 ? 'strong' : clamped >= 5 ? 'okay' : 'weak',
    complexity: {
      stated,
      estimatedTime: typeof parsed.estimatedTime === 'string' ? parsed.estimatedTime.slice(0, 60) : null,
      estimatedSpace: typeof parsed.estimatedSpace === 'string' ? parsed.estimatedSpace.slice(0, 60) : null,
      isOptimal: typeof parsed.isOptimal === 'boolean' ? parsed.isOptimal : null,
    },
    strengths: asStrings(parsed.strengths, 3),
    improvements: asStrings(parsed.improvements, 3),
    codeComments,
    optimalApproach: stripCode(typeof parsed.optimalApproach === 'string' ? parsed.optimalApproach : '').slice(0, 900),
    hintPenalty,
    generatedBy: 'gemini',
  }
}

export function buildEvaluationPrompt(input: CodingEvaluationInput): string {
  return [
    `PROBLEM: ${input.problem.title} (${input.problem.difficulty})`,
    input.problem.prompt.slice(0, 2000),
    `Expected optimal complexity: time ${input.problem.expectedComplexity.time}, space ${input.problem.expectedComplexity.space}`,
    '',
    `LANGUAGE: ${input.language}`,
    `FINAL CODE:\n${input.code.slice(0, 8000) || '(empty)'}`,
    '',
    `FINAL TEST RESULTS (all tests, including hidden):\n${describeRun(input.finalRun)}`,
    `Hints used: ${input.hintsUsed}. Time taken: ${Math.round(input.durationSeconds / 60)} min.`,
    '',
    `CONVERSATION:\n${lastMessages(input.messages, 40) || '(none)'}`,
  ].join('\n')
}

export class CodingInterviewerService {
  constructor(private readonly gemini: GeminiService) {}

  private ensureConfigured(): void {
    if (!this.gemini.isConfigured()) {
      throw new AppError('The AI coding interviewer is not configured on this server', { code: 'SERVICE_UNAVAILABLE', statusCode: 503 })
    }
  }

  async turn(input: CodingTurnInput): Promise<CodingTurnReply> {
    this.ensureConfigured()
    const raw = await this.gemini.generateText(TURN_SYSTEM_PROMPT, buildTurnPrompt(input), { maxOutputTokens: 600 })
    return parseTurn(raw, input)
  }

  async evaluate(input: CodingEvaluationInput): Promise<CodingEvaluation> {
    this.ensureConfigured()
    const raw = await this.gemini.generateText(EVALUATION_SYSTEM_PROMPT, buildEvaluationPrompt(input), { maxOutputTokens: 3000 })
    return parseEvaluation(raw, input)
  }
}
