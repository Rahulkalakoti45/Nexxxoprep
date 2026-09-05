import type { AnswerQuality, AnswerScore, FollowUpDirective } from '@nexoprep/types'

const FILLER_WORDS = /\b(um+|uh+|like|you know|basically|actually|sort of|kind of)\b/gi
const TECH_TERMS = /\b(api|algorithm|architecture|database|cache|async|component|deployment|latency|scale|security|testing|react|node|python|java|sql|docker|aws)\b/gi

export class AnswerScoringService {
  scoreAnswer(answer: string, context: { role: string; stage: string; lastQuestion?: string | null }): AnswerScore {
    const trimmed = answer.trim()
    const words = trimmed.split(/\s+/).filter(Boolean)
    const wordCount = words.length
    const fillerCount = (trimmed.match(FILLER_WORDS) || []).length
    const techMatches = (trimmed.match(TECH_TERMS) || []).length

    let technicalDepth = clamp(Math.round(2 + techMatches * 1.4 + (wordCount > 40 ? 2 : 0)))
    let communication = clamp(Math.round(6 - fillerCount * 0.8 + (wordCount > 15 ? 1 : -1)))
    let clarity = clamp(Math.round(5 + (trimmed.includes('.') ? 1 : 0) - (wordCount > 120 ? 2 : 0)))
    let completeness = clamp(Math.round(3 + Math.min(4, wordCount / 18)))
    let confidence = clamp(Math.round(6 - fillerCount - (wordCount < 8 ? 2 : 0)))

    if (context.stage === 'TECHNICAL_ROUND' || context.stage === 'DEEP_TECHNICAL') {
      technicalDepth = clamp(technicalDepth + 1)
      completeness = clamp(completeness + (techMatches > 0 ? 1 : -1))
    }

    if (wordCount < 6) {
      technicalDepth = Math.min(technicalDepth, 3)
      completeness = Math.min(completeness, 3)
      clarity = Math.min(clarity, 4)
    }

    const average = round1((technicalDepth + communication + clarity + completeness + confidence) / 5)
    const quality = classifyQuality(average, wordCount, techMatches)

    return {
      technicalDepth,
      communication,
      clarity,
      completeness,
      confidence,
      quality,
      average,
      scoredAt: new Date().toISOString(),
      answerPreview: trimmed.slice(0, 120),
    }
  }

  buildFollowUpDirective(score: AnswerScore, topic?: string): FollowUpDirective {
    const subject = topic || 'the previous topic'

    if (score.quality === 'WEAK') {
      return {
        quality: 'WEAK',
        depth: 'clarify',
        instruction: `The last answer was weak. Ask a clarifying follow-up about ${subject}. Probe for specifics, trade-offs, or what the candidate personally contributed.`,
      }
    }

    if (score.quality === 'STRONG') {
      return {
        quality: 'STRONG',
        depth: 'deep',
        instruction: `The last answer was strong. Increase depth on ${subject}. Ask an advanced follow-up (architecture, edge cases, performance, or design decisions).`,
      }
    }

    return {
      quality: 'AVERAGE',
      depth: 'standard',
      instruction: `The last answer was adequate. Continue with the next planned question in the current stage, or ask one targeted follow-up before moving on.`,
    }
  }
}

function classifyQuality(average: number, wordCount: number, techMatches: number): AnswerQuality {
  if (average >= 7.5 && wordCount >= 20 && techMatches >= 1) return 'STRONG'
  if (average <= 4.5 || wordCount < 10) return 'WEAK'
  return 'AVERAGE'
}

function clamp(value: number): number {
  return Math.max(0, Math.min(10, value))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
