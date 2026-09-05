const SKILL_KEYWORDS = [
  'javascript',
  'typescript',
  'react',
  'node',
  'express',
  'sql',
  'postgres',
  'mongodb',
  'redis',
  'docker',
  'kubernetes',
  'aws',
  'system design',
  'data structures',
  'algorithms',
  'dsa',
  'git',
  'testing',
  'jest',
  'ci/cd',
  'python',
  'java',
]

const TARGET_SKILLS_BY_ROLE = {
  SDE: ['data structures', 'algorithms', 'system design', 'javascript', 'react', 'sql', 'testing', 'git'],
  Backend: ['node', 'express', 'sql', 'postgres', 'redis', 'docker', 'aws', 'system design'],
  Frontend: ['react', 'javascript', 'typescript', 'testing', 'git', 'performance', 'accessibility'],
  'Data Analyst': ['sql', 'python', 'statistics', 'dashboard', 'excel', 'visualization'],
  'Product Manager': ['stakeholder', 'metrics', 'roadmap', 'prioritization', 'experimentation'],
  HR: ['communication', 'leadership', 'conflict', 'collaboration'],
}

function uniqueLower(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

function scoreResume({ skillsCount, hasProjects, hasExperience, missingCount }) {
  const base = 55
  const skillsScore = Math.min(22, skillsCount * 2.2)
  const sectionScore = (hasProjects ? 9 : 0) + (hasExperience ? 9 : 0)
  const penalty = Math.min(18, missingCount * 3)
  return Math.max(35, Math.min(96, Math.round(base + skillsScore + sectionScore - penalty)))
}

/**
 * Extracts real project and experience lines from resume plain text.
 * Strategy:
 *  - Detects section headers (Projects, Experience, Work Experience, etc.)
 *  - Reads lines after those headers until the next section header
 *  - Filters out very short lines (< 20 chars) which are likely sub-headers
 * Returns { projects: string[], experience: string[] }
 */
function extractSections(text) {
  if (!text || typeof text !== 'string') return { projects: [], experience: [] }

  // Split on newlines; preserve order
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // Regex to detect section headers
  const projectHeader = /^(projects?|personal projects?|notable projects?|key projects?)\s*:?\s*$/i
  const experienceHeader =
    /^(experience|work experience|professional experience|internships?|employment|positions?)\s*:?\s*$/i
  const anyHeader =
    /^(education|skills?|certifications?|awards?|achievements?|languages?|interests?|contact|summary|objective|references?|volunteer|hobbies|activities|publications?|projects?|experience|work experience|professional experience|internships?|employment|positions?)\s*:?\s*$/i

  const projects = []
  const experience = []

  let mode = null // 'project' | 'experience' | null

  for (const line of lines) {
    if (projectHeader.test(line)) {
      mode = 'project'
      continue
    }
    if (experienceHeader.test(line)) {
      mode = 'experience'
      continue
    }
    if (anyHeader.test(line)) {
      mode = null // entered an unrelated section
      continue
    }

    if (mode === 'project' && line.length >= 20) {
      projects.push(line)
    } else if (mode === 'experience' && line.length >= 20) {
      experience.push(line)
    }
  }

  // Fallback: if section parsing found nothing, use bullet/dash lines as candidates
  if (projects.length === 0) {
    const bulletLines = lines.filter((l) => /^[-•*▸→]\s+/.test(l) && l.length >= 25)
    projects.push(...bulletLines.slice(0, 5))
  }
  if (experience.length === 0) {
    const expKeywords =
      /\b(intern|engineer|developer|analyst|manager|lead|worked|built|developed|managed|designed|implemented|improved|reduced|increased)\b/i
    experience.push(...lines.filter((l) => expKeywords.test(l) && l.length >= 25).slice(0, 5))
  }

  return {
    projects: [...new Set(projects)].slice(0, 6),
    experience: [...new Set(experience)].slice(0, 6),
  }
}

export function analyzeResume(resumeText, role = 'SDE') {
  const text = (resumeText || '').toLowerCase()

  const extractedSkills = SKILL_KEYWORDS.filter((keyword) => text.includes(keyword))
  const skills = uniqueLower(extractedSkills.length ? extractedSkills : [])

  const target = TARGET_SKILLS_BY_ROLE[role] || TARGET_SKILLS_BY_ROLE.SDE
  const missingSkills = target.filter((skill) => !text.includes(skill))

  const hasProjects = /\bproject(s)?\b/.test(text) || /\bgithub\b/.test(text)
  const hasExperience = /\bexperience\b/.test(text) || /\bintern\b/.test(text) || /\bemployment\b/.test(text)

  const resumeScore = scoreResume({
    skillsCount: skills.length,
    hasProjects,
    hasExperience,
    missingCount: missingSkills.length,
  })

  const { projects, experience } = extractSections(resumeText)

  const improvementSuggestions = []
  if (!hasProjects) improvementSuggestions.push('Add 1-2 projects with measurable outcomes and links (GitHub/demo).')
  if (!hasExperience) improvementSuggestions.push('Add experience bullets with impact metrics (latency, revenue, users).')
  if (missingSkills.length) {
    improvementSuggestions.push(`Consider adding or highlighting: ${missingSkills.slice(0, 6).join(', ')}.`)
  }
  if (!/\b(metric|result|improved|reduced|increased|optimized)\b/.test(text)) {
    improvementSuggestions.push('Use action + metric format in bullets (e.g., “Improved X by Y%”).')
  }
  if (improvementSuggestions.length === 0) improvementSuggestions.push('Resume looks solid—tighten wording and ensure links are clickable.')

  return {
    skills,
    missingSkills,
    improvementSuggestions,
    resumeScore,
    projects,
    experience,
  }
}

export function optimizeResumeText(resumeText) {
  const text = (resumeText || '').trim()
  if (!text) return ''
  return `${text}\n\nOptimized bullets (mock):\n- Improved performance by identifying bottlenecks and applying targeted fixes.\n- Delivered features end-to-end with measurable outcomes and stakeholder alignment.\n`
}

