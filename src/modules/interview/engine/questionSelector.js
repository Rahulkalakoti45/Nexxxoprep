import { isValidQuestion } from '../utils/validators'
import { orderQuestions } from '../utils/questionHelpers'
import { getCompanyProfile } from './companyRoundEngine'
import commonAptitude from '../data/common/aptitude'
import commonBehavioral from '../data/common/behavioral'
import commonHr from '../data/common/hr'

function norm(v) {
  return String(v || '').trim().toLowerCase()
}

function difficultyOk(q, difficulty) {
  const d = norm(difficulty)
  if (!d) return true
  return norm(q.difficulty) === d
}

function roleOk(q, role) {
  const r = norm(role)
  if (!r) return true
  return norm(q.role) === r || norm(q.role) === 'any'
}

export function buildResumeDerivedQuestions({ company, role, difficulty, resume }) {
  if (!resume) return []
  const projects = Array.isArray(resume.projects) ? resume.projects : []
  const skills = Array.isArray(resume.skills) ? resume.skills : []
  const experience = Array.isArray(resume.experience) ? resume.experience : []

  const roleKey = norm(role)
  const rolePrompt =
    roleKey.includes('frontend')
      ? 'Focus on React performance, state, and UI tradeoffs.'
      : roleKey.includes('backend')
        ? 'Focus on API design, data consistency, and scaling tradeoffs.'
        : roleKey.includes('data analyst')
          ? 'Focus on SQL, metrics, and analysis rigor.'
          : roleKey.includes('product manager')
            ? 'Focus on user impact, prioritization, and product metrics.'
            : roleKey.includes('hr')
              ? 'Focus on communication, fit, and conflict resolution.'
              : 'Focus on engineering tradeoffs, correctness, and impact.'

  const derived = []
  if (projects[0]) {
    derived.push({
      id: `resume-project-1`,
      company,
      role,
      round: 'Resume + Project Discussion',
      domain: 'project',
      difficulty: difficulty || 'Medium',
      question: `You mentioned: "${projects[0]}". What was the hardest challenge, what tradeoff did you make, and what measurable result did you achieve?\n\n(${rolePrompt})`,
      expectedConcepts: ['tradeoffs', 'impact', 'metrics', 'design decisions'],
      followUpTemplates: ['What would you change if you rebuild it today?', 'How did you measure success?'],
      estimatedTime: 210,
    })
  }
  if (skills[0]) {
    derived.push({
      id: `resume-skill-1`,
      company,
      role,
      round: 'Resume + Project Discussion',
      domain: 'skill',
      difficulty: difficulty || 'Medium',
      question: `Your resume lists "${skills[0]}". Explain a real scenario where you used it, the constraints, and the tradeoffs.\n\n(${rolePrompt})`,
      expectedConcepts: [skills[0], 'tradeoffs', 'constraints', 'problem solving'],
      followUpTemplates: ['What pitfalls did you face?', 'How would you evaluate alternatives?'],
      estimatedTime: 180,
    })
  }
  if (experience[0]) {
    derived.push({
      id: `resume-exp-1`,
      company,
      role,
      round: 'Resume + Project Discussion',
      domain: 'resume',
      difficulty: difficulty || 'Medium',
      question: `In "${experience[0]}", what was your exact scope, how did you ensure quality, and how did you communicate progress?\n\n(${rolePrompt})`,
      expectedConcepts: ['ownership', 'quality', 'communication', 'metrics'],
      followUpTemplates: ['How did you collaborate across stakeholders?', 'What was the biggest risk?'],
      estimatedTime: 210,
    })
  }

  return derived.filter(isValidQuestion)
}

export function selectQuestions({ company, role, difficulty, rounds, resume }) {
  const profile = getCompanyProfile(company)
  const base = (profile?.questions || []).filter((q) => isValidQuestion(q) && roleOk(q, role) && difficultyOk(q, difficulty))

  const commonPools = [...commonAptitude, ...commonBehavioral, ...commonHr].filter((q) => isValidQuestion(q) && difficultyOk(q, difficulty))
  const derived = buildResumeDerivedQuestions({ company, role, difficulty, resume })

  const roundLabels = new Set((rounds || []).map((r) => r.label))
  const picked = []

  // First, derived resume/project questions if the company has a resume round.
  for (const q of derived) {
    if (roundLabels.has(q.round)) picked.push(q)
  }

  // Next, company questions round-by-round (no random mixing).
  for (const round of rounds || []) {
    const inRound = base.filter((q) => q.round === round.label)
    for (const q of inRound) picked.push(q)
  }

  // Fill gaps with common pool mapped to missing rounds.
  for (const round of rounds || []) {
    const hasAny = picked.some((q) => q.round === round.label)
    if (hasAny) continue
    const fallback = commonPools.find((q) => norm(q.domain) === norm(round.domain)) || commonPools[0]
    if (fallback) {
      picked.push({
        ...fallback,
        id: `${company}-fallback-${round.id}-${fallback.id}`,
        company,
        role,
        round: round.label,
        difficulty: difficulty || fallback.difficulty,
      })
    }
  }

  return orderQuestions(picked.filter(isValidQuestion))
}

