import type { CandidateProfile } from '@nexoprep/types'

const PROJECT_PATTERNS = [
/(?:project|built|developed|created|designed|implemented)\s+[:\-]?\s*([^.;\n]{8,80})/gi,
/(?:^|\n)\s*[-•*]\s*([A-Z][^.;\n]{10,100})/gm,
]

const EXPERIENCE_PATTERNS = [
/(?:worked at|employed at|intern at|experience at)\s+([^.;\n]{4,60})/gi,
/(?:^|\n)\s*(?:senior|junior|lead|software|full[\s-]?stack|backend|frontend)\s+[^.\n]{8,80}/gim,
]

const EDUCATION_PATTERNS = [
/(?:b\.?tech|b\.?e|m\.?tech|bachelor|master|ph\.?d|university|college|institute)[^.;\n]{0,80}/gi,
]

const TECH_PATTERNS = [
  /\b(react|vue|angular|node\.?js|express|django|flask|spring|docker|kubernetes|aws|gcp|azure|postgresql|mongodb|redis|typescript|javascript|python|java|go|rust|c\+\+|graphql|kafka|terraform)\b/gi,
]

interface ResumeAnalysisRecord {
  extractedSkills?: unknown
  rawAnalysis?: unknown
}

export class CandidateProfileService {
  fromResumeText(resumeText: string, extractedSkills: string[] = []): CandidateProfile {
    const normalized = resumeText.replace(/\s+/g, ' ').trim()
    const skills = this.unique([...extractedSkills, ...this.matchPatterns(normalized, [SKILL_INLINE_PATTERN])])
    const projects = this.extractProjects(normalized)
    const experience = this.extractExperience(normalized)
    const education = this.matchPatterns(normalized, EDUCATION_PATTERNS).slice(0, 4)
    const technologies = this.unique([...skills, ...this.matchPatterns(normalized, TECH_PATTERNS)])

    return {
      skills: skills.slice(0, 20),
      projects: projects.slice(0, 8),
      experience: experience.slice(0, 6),
      education: education.slice(0, 4),
      technologies: technologies.slice(0, 25),
    }
  }

  fromResumeAnalysis(record: ResumeAnalysisRecord): CandidateProfile {
    const extractedSkills = this.toStringArray(record.extractedSkills)
    const raw = (record.rawAnalysis || {}) as Record<string, unknown>
    const resumeSnippet = typeof raw.resumeSnippet === 'string' ? raw.resumeSnippet : ''

    if (resumeSnippet) {
      return this.fromResumeText(resumeSnippet, extractedSkills)
    }

    if (extractedSkills.length) {
      return {
        skills: extractedSkills,
        projects: extractedSkills.slice(0, 3).map((skill) => `Project using ${skill}`),
        experience: [],
        education: [],
        technologies: extractedSkills,
      }
    }

    return {
      skills: [],
      projects: [],
      experience: [],
      education: [],
      technologies: [],
    }
  }

  buildResumeSummaryFromProfile(profile: CandidateProfile | null, resumeText?: string): string {
    if (resumeText?.trim()) {
      return resumeText.replace(/\s+/g, ' ').trim().slice(0, 400)
    }
    if (!profile) return ''
    return [
      profile.projects.slice(0, 2).join('; '),
      profile.skills.slice(0, 8).join(', '),
    ]
      .filter(Boolean)
      .join(' | ')
  }

  getQuestionSeeds(profile: CandidateProfile): string[] {
    const seeds: string[] = []
    for (const project of profile.projects.slice(0, 3)) seeds.push(`project:${project}`)
    for (const skill of profile.skills.slice(0, 5)) seeds.push(`skill:${skill}`)
    for (const exp of profile.experience.slice(0, 2)) seeds.push(`experience:${exp}`)
    return seeds
  }

  formatForPrompt(profile: CandidateProfile | null | undefined): string {
    if (!profile) return 'No resume profile available. Ask general role-based questions.'
    return [
      'Candidate profile (priority: projects > skills > experience):',
      profile.projects.length ? `Projects: ${profile.projects.join('; ')}` : '',
      profile.skills.length ? `Skills: ${profile.skills.join(', ')}` : '',
      profile.experience.length ? `Experience: ${profile.experience.join('; ')}` : '',
      profile.education.length ? `Education: ${profile.education.join('; ')}` : '',
      profile.technologies.length ? `Technologies: ${profile.technologies.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  private extractProjects(text: string): string[] {
    const found: string[] = []
    for (const pattern of PROJECT_PATTERNS) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const value = (match[1] || match[0]).trim()
        if (value.length > 8) found.push(value)
      }
    }
    return this.unique(found)
  }

  private extractExperience(text: string): string[] {
    const found: string[] = []
    for (const pattern of EXPERIENCE_PATTERNS) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const value = (match[1] || match[0]).trim()
        if (value.length > 6) found.push(value)
      }
    }
    return this.unique(found)
  }

  private matchPatterns(text: string, patterns: RegExp[]): string[] {
    const found: string[] = []
    for (const pattern of patterns) {
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
      const re = new RegExp(pattern.source, flags)
      const matches = text.match(re) || []
      found.push(...matches.map((m) => m.trim()))
    }
    return this.unique(found)
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string')
  }

  private unique(items: string[]): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of items) {
      const key = item.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(item)
      }
    }
    return out
  }
}

const SKILL_INLINE_PATTERN = /\b(javascript|typescript|python|java|react|node\.?js|sql|postgresql|redis|aws|docker|kubernetes|git|html|css|mongodb|express|fastapi|django|spring|angular|vue|next\.?js)\b/gi
