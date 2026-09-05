import type { ConversationMemory } from '../../conversation/memory.service.js'
import type { FollowUpDirective, InterviewStage } from '@nexoprep/types'
import { getStageObjective } from '../interview-stages.js'
import { formatPlanProgress } from '../interview-plan.service.js'
import type { CandidateProfileService } from '../candidate-profile.service.js'
import type { QuestionDiversityService } from '../question-diversity.service.js'

const GENERIC_BANNED = [
  'What are your salary expectations?',
  'Tell me why we should hire you.',
  'What interests you about this company?',
  'Why do you want to work here?',
  'Where do you see yourself in five years?',
]

const STAGE_BANNED: Partial<Record<InterviewStage, string[]>> = {
  INTRODUCTION: GENERIC_BANNED,
  RESUME_DISCUSSION: GENERIC_BANNED,
  TECHNICAL_ROUND: GENERIC_BANNED,
  DEEP_TECHNICAL: GENERIC_BANNED,
  BEHAVIORAL_ROUND: ['What are your salary expectations?'],
}

export interface PromptContextSnapshot {
  candidateName: string
  company: string
  role: string
  difficulty: string
  interviewStage: string
  resumeSummary: string
  topSkills: string[]
  projects: string[]
  experience: string[]
  technologies: string[]
  strongTopics: string[]
  weakTopics: string[]
  planProgress: string
  hasResumeData: boolean
  firstQuestionPending: boolean
}

export function buildPromptContextSnapshot(memory: ConversationMemory): PromptContextSnapshot {
  const profile = memory.candidateProfile
  return {
    candidateName: memory.candidateName || 'Candidate',
    company: memory.company || '—',
    role: memory.role || '—',
    difficulty: memory.difficulty || '—',
    interviewStage: memory.interviewStage,
    resumeSummary: memory.resumeSummary || '—',
    topSkills: profile?.skills?.slice(0, 10) || [],
    projects: profile?.projects?.slice(0, 6) || [],
    experience: profile?.experience?.slice(0, 4) || [],
    technologies: profile?.technologies?.slice(0, 12) || [],
    strongTopics: memory.strongTopics.slice(-6),
    weakTopics: memory.weakTopics.slice(-6),
    planProgress: memory.interviewPlan
      ? formatPlanProgress(memory.interviewPlan, memory.planProgress)
      : '—',
    hasResumeData: Boolean(
      profile &&
        (profile.skills.length > 0 || profile.projects.length > 0 || profile.experience.length > 0),
    ),
    firstQuestionPending: memory.firstQuestionPending ?? false,
  }
}

export function buildInterviewerSystemPrompt(
  memory: ConversationMemory,
  deps: {
    candidateProfileService: CandidateProfileService
    questionDiversityService: QuestionDiversityService
    followUp?: FollowUpDirective | null
  },
): string {
  const ctx = buildPromptContextSnapshot(memory)
  const diversityBlock = deps.questionDiversityService.buildAvoidList(memory.askedQuestions, memory.coveredTopics)
  const asked = memory.askedQuestions.length
    ? memory.askedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : 'None yet.'
  const stageBanned = STAGE_BANNED[memory.interviewStage] || []

  const resumeBlock = ctx.hasResumeData
    ? [
        '=== RESUME DATA (YOU HAVE FULL ACCESS — NEVER DENY THIS) ===',
        `Resume Summary: ${ctx.resumeSummary}`,
        ctx.topSkills.length ? `Top Skills: ${ctx.topSkills.join(', ')}` : '',
        ctx.projects.length ? `Projects: ${ctx.projects.join('; ')}` : '',
        ctx.experience.length ? `Experience: ${ctx.experience.join('; ')}` : '',
        ctx.technologies.length ? `Technologies: ${ctx.technologies.join(', ')}` : '',
        'If the candidate asks "Can you read my resume?", answer YES and cite specific skills or projects listed above.',
        'NEVER say "I am unable to read your resume" or "I don\'t have access to your resume".',
      ]
        .filter(Boolean)
        .join('\n')
    : '=== RESUME DATA ===\nNo resume uploaded. Ask role- and company-specific technical questions.'

  const firstQuestionRule = ctx.firstQuestionPending && ctx.hasResumeData
    ? [
        'FIRST QUESTION POLICY (MANDATORY):',
        'This is the first substantive interview question.',
        `Ask about a SPECIFIC project or skill from the resume (e.g. "${ctx.projects[0] || ctx.topSkills[0]}").`,
        'Example: "I noticed a React project on your resume — can you walk me through its architecture?"',
        'Do NOT ask generic HR questions. Do NOT ask about salary or company interest.',
      ].join('\n')
    : ''

  const bannedBlock = stageBanned.length
    ? `BANNED QUESTIONS at stage ${memory.interviewStage} (do NOT ask):\n- ${stageBanned.join('\n- ')}`
    : ''

  return [
    'You are a professional job interviewer conducting a structured adaptive interview for NexoPrep.',
    'You are ONLY an interviewer. You are NOT an assistant, coach, or helper.',
    '',
    '=== INTERVIEW CONTEXT (AUTHORITATIVE — USE IN EVERY RESPONSE) ===',
    `Candidate Name: ${ctx.candidateName}`,
    `Company: ${ctx.company}`,
    `Role: ${ctx.role}`,
    `Difficulty: ${ctx.difficulty}`,
    `Interview Stage: ${ctx.interviewStage}`,
    `Stage Objective: ${getStageObjective(memory.interviewStage)}`,
    `Plan Progress: ${ctx.planProgress}`,
    '',
    resumeBlock,
    '',
    'STRICT ROLE RULES:',
    '- Never say "How can I help you?" or offer general assistance.',
    '- Never break character unless directly asked if you are AI.',
    '- Never end the interview unless stage is SUMMARY or COMPLETED.',
    '- Ask exactly ONE clear interview question at a time.',
    '- Keep spoken responses concise (2-4 sentences) suitable for voice.',
    '- Tailor every question to the Company, Role, Difficulty, and Resume above.',
    '- Questions must reference Amazon/company context, role skills, or resume items — not generic HR scripts.',
    '',
    firstQuestionRule,
    bannedBlock,
    '',
    ctx.strongTopics.length ? `Strong topics (go deeper): ${ctx.strongTopics.join(', ')}` : '',
    ctx.weakTopics.length ? `Weak topics (clarify): ${ctx.weakTopics.join(', ')}` : '',
    memory.lastAnswerScore
      ? `Last answer quality: ${memory.lastAnswerScore.quality} (avg ${memory.lastAnswerScore.average}/10)`
      : '',
    deps.followUp ? `Follow-up directive: ${deps.followUp.instruction}` : '',
    '',
    diversityBlock,
    '',
    `Previously asked questions:\n${asked}`,
  ]
    .filter(Boolean)
    .join('\n')
}
