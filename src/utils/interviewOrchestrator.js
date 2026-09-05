import { companyQuestionBank } from '../data/companyQuestionBank.js'

const ROUND_BLUEPRINT = [
  { title: 'Resume Analysis Round', difficulty: 'Medium', timing: 6, questionCount: 2, scoringWeight: 0.15, domain: 'Resume' },
  { title: 'Technical Skills', difficulty: 'Medium', timing: 12, questionCount: 3, scoringWeight: 0.3, domain: 'Technical' },
  { title: 'Company-Specific Questions', difficulty: 'Medium', timing: 8, questionCount: 2, scoringWeight: 0.2, domain: 'Company Fit' },
  { title: 'Problem Solving / Aptitude', difficulty: 'Medium', timing: 8, questionCount: 2, scoringWeight: 0.15, domain: 'Aptitude' },
  { title: 'Behavioral + Decision Making', difficulty: 'Medium', timing: 9, questionCount: 2, scoringWeight: 0.2, domain: 'Behavioral' },
]

function pick(items, count) {
  if (!items?.length) return []
  return items.slice(0, Math.min(count, items.length))
}

function normalizeQuestion(q, roundName, fallbackRole, fallbackCompany, fallbackDifficulty) {
  return {
    id: q.id,
    company: q.company || fallbackCompany,
    role: q.role || fallbackRole,
    domain: q.domain || 'General',
    difficulty: q.difficulty || fallbackDifficulty,
    round: q.round || roundName,
    roundName,
    type: q.domain || 'General',
    question: q.question,
    expectedKeywords: q.expectedKeywords || [],
    followUpQuestions: q.followUpQuestions || [],
    scoringHints: q.scoringHints || [],
    expectedAnswer: q.scoringHints?.[0] || 'Provide a clear, structured answer with measurable outcome.',
  }
}

export function generateFallbackQuestions(config = {}) {
  const role = config.role || 'SDE'
  const company = config.company || 'General'
  const difficulty = config.difficulty || 'Medium'

  return [
    {
      roundName: 'Resume Analysis Round',
      questions: [
        normalizeQuestion(
          {
            id: 'fallback-resume-1',
            question: 'Walk me through one resume project and explain your direct impact.',
            domain: 'Resume',
            expectedKeywords: ['impact', 'metric', 'ownership'],
            followUpQuestions: ['What challenge did you face and how did you solve it?'],
            scoringHints: ['Clear ownership', 'Metric-backed outcome'],
          },
          'Resume Analysis Round',
          role,
          company,
          difficulty,
        ),
      ],
    },
    {
      roundName: 'Technical Skills',
      questions: [
        normalizeQuestion(
          {
            id: 'fallback-tech-1',
            question: 'How would you optimize an API that is experiencing high response time?',
            domain: 'Backend',
            expectedKeywords: ['profiling', 'cache', 'index', 'latency'],
            followUpQuestions: ['How would you validate the performance improvement?'],
            scoringHints: ['Systematic optimization approach'],
          },
          'Technical Skills',
          role,
          company,
          difficulty,
        ),
      ],
    },
    {
      roundName: 'Behavioral + Decision Making',
      questions: [
        normalizeQuestion(
          {
            id: 'fallback-beh-1',
            question: 'Describe a high-pressure situation and how you made decisions under constraints.',
            domain: 'HR',
            expectedKeywords: ['prioritization', 'communication', 'outcome'],
            followUpQuestions: ['What would you change if you faced it again?'],
            scoringHints: ['Decision framework', 'Learning mindset'],
          },
          'Behavioral + Decision Making',
          role,
          company,
          difficulty,
        ),
      ],
    },
  ]
}

export function buildInterviewPipeline(config = {}, resume = null) {
  const role = config.role || 'SDE'
  const company = config.company || 'Amazon'
  const difficulty = config.difficulty || 'Medium'
  const companyConfig = companyQuestionBank[company] || companyQuestionBank.Amazon
  const roleConfig = companyConfig.roles?.[role] || companyConfig.roles?.SDE || {}

  const resumeRoundQuestions = [
    normalizeQuestion(
      {
        id: `${company}-${role}-resume-1`,
        question: resume?.skills?.length
          ? `Your resume highlights ${resume.skills.slice(0, 3).join(', ')}. Explain one impact story with metrics.`
          : 'Pick one resume item and explain how it demonstrates ownership and measurable impact.',
        domain: 'Resume',
        expectedKeywords: ['impact', 'metric', 'ownership'],
        followUpQuestions: ['How would you improve that result by another 20%?'],
        scoringHints: ['Evidence-based storytelling'],
      },
      'Resume Analysis Round',
      role,
      company,
      difficulty,
    ),
    normalizeQuestion(
      {
        id: `${company}-${role}-resume-2`,
        question: 'Which project on your resume best matches this role, and why?',
        domain: 'Resume',
        expectedKeywords: ['alignment', 'skills', 'business impact'],
        followUpQuestions: ['Which gap remains and how are you closing it?'],
        scoringHints: ['Role alignment and self-awareness'],
      },
      'Resume Analysis Round',
      role,
      company,
      difficulty,
    ),
  ]

  const technical = (roleConfig.technical || []).map((q) =>
    normalizeQuestion(q, 'Technical Skills', role, company, difficulty),
  )
  const companyRound = (roleConfig.company || []).map((q) =>
    normalizeQuestion(q, 'Company-Specific Questions', role, company, difficulty),
  )
  const aptitude = (roleConfig.aptitude || []).map((q) =>
    normalizeQuestion(q, 'Problem Solving / Aptitude', role, company, difficulty),
  )
  const behavioral = [
    normalizeQuestion(
      {
        id: `${company}-${role}-behavioral-1`,
        question: 'Tell me about a time you made a difficult trade-off under a deadline.',
        domain: 'HR',
        expectedKeywords: ['trade-off', 'decision', 'result'],
        followUpQuestions: ['How did you communicate risks to stakeholders?'],
        scoringHints: ['Decision quality', 'Communication'],
      },
      'Behavioral + Decision Making',
      role,
      company,
      difficulty,
    ),
    normalizeQuestion(
      {
        id: `${company}-${role}-behavioral-2`,
        question: 'Describe a disagreement with a teammate and how you resolved it.',
        domain: 'HR',
        expectedKeywords: ['conflict', 'collaboration', 'outcome'],
        followUpQuestions: ['What did you learn from this conflict?'],
        scoringHints: ['Maturity and collaboration'],
      },
      'Behavioral + Decision Making',
      role,
      company,
      difficulty,
    ),
  ]

  const rounds = ROUND_BLUEPRINT.map((blueprint) => {
    let source = []
    if (blueprint.title === 'Resume Analysis Round') source = resumeRoundQuestions
    if (blueprint.title === 'Technical Skills') source = technical
    if (blueprint.title === 'Company-Specific Questions') source = companyRound
    if (blueprint.title === 'Problem Solving / Aptitude') source = aptitude
    if (blueprint.title === 'Behavioral + Decision Making') source = behavioral

    return {
      roundName: blueprint.title,
      ...blueprint,
      questions: pick(source, blueprint.questionCount),
    }
  }).filter((round) => round.questions.length > 0)

  const safeRounds = rounds.length ? rounds : generateFallbackQuestions(config)
  const flatQuestions = safeRounds.flatMap((round) =>
    round.questions.map((q) => ({
      ...q,
      roundName: round.roundName,
      timing: round.timing,
      scoringWeight: round.scoringWeight,
    })),
  )

  return { rounds: safeRounds, questions: flatQuestions, structure: ROUND_BLUEPRINT, companyFocus: companyConfig.focus || [] }
}

