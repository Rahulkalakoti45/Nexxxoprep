import { COMPANY_QUESTION_BANK } from '../data/companies/questions.js'
import { APTITUDE_QUESTIONS } from '../data/aptitude/questions.js'
import { BEHAVIORAL_QUESTIONS } from '../data/behavioral/questions.js'
import { ROLE_QUESTION_BANK } from '../data/roles/questions.js'
import { getCompanyRounds } from './companyRoundEngine.js'
import { pickQuestionsForRound, sortQuestionsByRolePriority } from './questionSelector.js'

const FALLBACK_QUESTION = {
  id: 'fallback-1',
  company: 'General',
  role: 'SDE',
  round: 'Introduction',
  domain: 'Behavioral',
  difficulty: 'Easy',
  question: 'Tell me about yourself and your strongest project impact.',
  expectedConcepts: ['impact', 'ownership'],
  followUpTemplates: [],
  estimatedTime: 120,
  type: 'Behavioral',
}

function toType(domain) {
  const mapping = {
    resume: 'Resume-based',
    'skill-based': 'Skill-based',
    project: 'Project-based',
    'company-specific': 'Company-specific',
    'coding/dsa': 'Coding/DSA',
    'system design': 'System Design',
    aptitude: 'Aptitude',
    hr: 'HR',
    behavioral: 'Behavioral',
    communication: 'Behavioral',
    'decision making': 'Decision Making',
    fundamentals: 'Programming Fundamentals',
    'programming fundamentals': 'Programming Fundamentals',
  }
  return mapping[(domain || '').toString().toLowerCase()] || 'Skill-based'
}

function normalizeQuestion(q, idx, company, role, roundName) {
  const concepts = Array.isArray(q.expectedConcepts) ? q.expectedConcepts : []
  return {
    id: q.id || `${company}-${role}-q-${idx + 1}`,
    company: q.company || company,
    role: q.role || role,
    round: q.round || q.roundName || roundName || 'General',
    roundName: q.roundName || q.round || roundName || 'General',
    domain: q.domain || 'Behavioral',
    difficulty: q.difficulty || 'Medium',
    question: q.question || FALLBACK_QUESTION.question,
    expectedConcepts: concepts,
    expectedKeywords: concepts,
    followUpTemplates: Array.isArray(q.followUpTemplates) ? q.followUpTemplates : [],
    estimatedTime: q.estimatedTime || 120,
    type: q.type || toType(q.domain),
    isFallback: Boolean(q.isFallback),
  }
}

function buildFallbackRound(roundName, company, role) {
  return [normalizeQuestion({ ...FALLBACK_QUESTION, round: roundName, roundName, company, role, isFallback: true }, 0, company, role, roundName)]
}

function ensureMinimumQuestions(questions, expectedCount, roundName, company, role) {
  const safe = Array.isArray(questions) ? questions.slice() : []
  const target = Math.max(1, Number.isFinite(expectedCount) ? expectedCount : 1)
  while (safe.length < target) {
    safe.push(
      normalizeQuestion(
        {
          ...FALLBACK_QUESTION,
          id: `${company}-${roundName}-fallback-${safe.length + 1}`,
          round: roundName,
          roundName,
          company,
          role,
          isFallback: true,
        },
        safe.length,
        company,
        role,
        roundName,
      ),
    )
  }
  return safe
}

function withSafeNumber(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

export function createInterviewSession({ company = 'General', role = 'SDE', mode = 'standard' } = {}) {
  const safeCompany = typeof company === 'string' && company.trim() ? company.trim() : 'General'
  const safeRole = typeof role === 'string' && role.trim() ? role.trim() : 'SDE'
  const rounds = getCompanyRounds(safeCompany)
  const pool = sortQuestionsByRolePriority(
    [...COMPANY_QUESTION_BANK, ...ROLE_QUESTION_BANK, ...APTITUDE_QUESTIONS, ...BEHAVIORAL_QUESTIONS],
    safeRole,
  )

  const normalizedRounds = rounds.map((roundConfig) => {
    const selected = pickQuestionsForRound(pool, roundConfig.round, roundConfig.questionCount, {
      role: safeRole,
      company: safeCompany,
    })
    const normalizedSelected = (selected.length ? selected : buildFallbackRound(roundConfig.round, safeCompany, safeRole)).map(
      (question, index) => normalizeQuestion(question, index, safeCompany, safeRole, roundConfig.round),
    )
    const safeQuestions = ensureMinimumQuestions(
      normalizedSelected,
      roundConfig.questionCount,
      roundConfig.round,
      safeCompany,
      safeRole,
    )
    return {
      ...roundConfig,
      roundName: roundConfig.round,
      questions: safeQuestions,
    }
  })

  const questions = normalizedRounds.flatMap((round) => round.questions)
  const safeQuestions = questions.length ? questions : [normalizeQuestion(FALLBACK_QUESTION, 0, safeCompany, safeRole, 'General')]

  return {
    sessionId: `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    company: safeCompany,
    role: safeRole,
    mode,
    rounds: normalizedRounds,
    questions: safeQuestions,
    flattenedQuestions: safeQuestions,
    currentQuestionIndex: withSafeNumber(0),
    currentRoundIndex: withSafeNumber(0),
    answers: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  }
}
