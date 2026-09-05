import { createHash } from 'node:crypto'
import { toPrismaJson, type DatabaseClient } from '@nexoprep/database'
import { NotFoundError, ValidationError } from '@nexoprep/shared'

const SKILL_PATTERNS = [
  /\b(javascript|typescript|python|java|react|node\.?js|sql|postgresql|redis|aws|docker|kubernetes|git)\b/gi,
]

const SECTION_HEADERS = /(experience|education|skills|projects|summary|certifications)/i

export interface AnalyzeResumeInput {
  userId: string
  resumeText: string
  targetRole?: string
  company?: string
}

export class ResumeService {
  constructor(private readonly prisma: DatabaseClient) {}

  async analyzeAndStore(input: AnalyzeResumeInput) {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } })
    if (!user) throw new NotFoundError('User', { userId: input.userId })

    const normalized = input.resumeText.replace(/\s+/g, ' ').trim()
    if (!normalized) throw new ValidationError('Resume text is required', { field: 'resumeText' })

    const extractedSkills = this.extractSkills(normalized)
    const resumeSnippet = normalized.slice(0, 3000)
    const missingSkills = this.inferMissingSkills(extractedSkills, input.targetRole || user.targetRole || 'SDE')
    const atsScore = this.scoreAts(normalized, extractedSkills)
    const resumeScore = Math.round((atsScore + Math.min(100, extractedSkills.length * 8)) / 2)
    const suggestions = this.buildSuggestions(normalized, missingSkills)
    const resumeTextHash = createHash('sha256').update(normalized).digest('hex')

    const record = await this.prisma.resumeAnalysis.create({
      data: {
        userId: input.userId,
        resumeTextHash,
        extractedSkills: toPrismaJson(extractedSkills),
        missingSkills: toPrismaJson(missingSkills),
        atsScore,
        resumeScore,
        suggestions: toPrismaJson(suggestions),
        rawAnalysis: toPrismaJson({
          targetRole: input.targetRole || user.targetRole,
          company: input.company,
          wordCount: normalized.split(' ').filter(Boolean).length,
          sectionsDetected: SECTION_HEADERS.test(normalized),
          resumeSnippet,
        }),
      },
    })

    return record
  }

  async getLatest(userId: string) {
    return this.prisma.resumeAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  private extractSkills(text: string): string[] {
    const found = new Set<string>()
    for (const pattern of SKILL_PATTERNS) {
      const matches = text.match(pattern) || []
      for (const match of matches) found.add(match.toLowerCase())
    }
    return Array.from(found).slice(0, 30)
  }

  private inferMissingSkills(skills: string[], role: string): string[] {
    const roleLower = role.toLowerCase()
    const expected =
      roleLower.includes('frontend')
        ? ['javascript', 'react', 'typescript', 'css']
        : roleLower.includes('data')
          ? ['python', 'sql', 'statistics']
          : ['javascript', 'python', 'sql', 'git', 'react']
    return expected.filter((skill) => !skills.includes(skill)).slice(0, 8)
  }

  private scoreAts(text: string, skills: string[]): number {
    let score = 45
    if (text.length > 400) score += 15
    if (text.length > 900) score += 10
    if (skills.length >= 4) score += 15
    if (SECTION_HEADERS.test(text)) score += 10
    if (/\d+%|\d+\+|\$\d+/i.test(text)) score += 10
    return Math.min(100, score)
  }

  private buildSuggestions(text: string, missingSkills: string[]): string[] {
    const suggestions = []
    if (missingSkills.length) {
      suggestions.push(`Add explicit mentions of: ${missingSkills.slice(0, 4).join(', ')}`)
    }
    if (!/\d+%|\d+\+/i.test(text)) {
      suggestions.push('Include measurable outcomes (%, users, latency, revenue).')
    }
    if (text.length < 500) {
      suggestions.push('Expand project and experience sections with impact-focused bullets.')
    }
    return suggestions.slice(0, 6)
  }
}
