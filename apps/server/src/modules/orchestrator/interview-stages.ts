import type { InterviewPlan, InterviewPlanProgress, InterviewStage } from '@nexoprep/types'

export const INTERVIEW_STAGES: InterviewStage[] = [
  'INTRODUCTION',
  'RESUME_DISCUSSION',
  'TECHNICAL_ROUND',
  'DEEP_TECHNICAL',
  'BEHAVIORAL_ROUND',
  'HR_ROUND',
  'SUMMARY',
  'COMPLETED',
]

const INTRODUCTION_BUDGET = 1

export function getStageBudget(stage: InterviewStage, plan: InterviewPlan): number {
  switch (stage) {
    case 'INTRODUCTION':
      return INTRODUCTION_BUDGET
    case 'RESUME_DISCUSSION':
      return plan.resumeQuestions
    case 'TECHNICAL_ROUND':
      return Math.ceil(plan.technicalQuestions * 0.55)
    case 'DEEP_TECHNICAL':
      return Math.max(1, plan.technicalQuestions - Math.ceil(plan.technicalQuestions * 0.55))
    case 'BEHAVIORAL_ROUND':
      return plan.behavioralQuestions
    case 'HR_ROUND':
      return plan.hrQuestions
    case 'SUMMARY':
      return 1
    case 'COMPLETED':
      return 0
    default:
      return 0
  }
}

export function getStageProgress(stage: InterviewStage, progress: InterviewPlanProgress): number {
  switch (stage) {
    case 'INTRODUCTION':
      return progress.introduction
    case 'RESUME_DISCUSSION':
      return progress.resume
    case 'TECHNICAL_ROUND':
      return progress.technical
    case 'DEEP_TECHNICAL':
      return progress.deepTechnical
    case 'BEHAVIORAL_ROUND':
      return progress.behavioral
    case 'HR_ROUND':
      return progress.hr
    case 'SUMMARY':
      return progress.summary
    default:
      return 0
  }
}

export function incrementStageProgress(stage: InterviewStage, progress: InterviewPlanProgress): InterviewPlanProgress {
  const next = { ...progress }
  switch (stage) {
    case 'INTRODUCTION':
      next.introduction += 1
      break
    case 'RESUME_DISCUSSION':
      next.resume += 1
      break
    case 'TECHNICAL_ROUND':
      next.technical += 1
      break
    case 'DEEP_TECHNICAL':
      next.deepTechnical += 1
      break
    case 'BEHAVIORAL_ROUND':
      next.behavioral += 1
      break
    case 'HR_ROUND':
      next.hr += 1
      break
    case 'SUMMARY':
      next.summary += 1
      break
    default:
      break
  }
  return next
}

export function isStageComplete(stage: InterviewStage, plan: InterviewPlan, progress: InterviewPlanProgress): boolean {
  return getStageProgress(stage, progress) >= getStageBudget(stage, plan)
}

export function nextStage(current: InterviewStage): InterviewStage {
  const idx = INTERVIEW_STAGES.indexOf(current)
  if (idx < 0 || idx >= INTERVIEW_STAGES.length - 1) return 'COMPLETED'
  return INTERVIEW_STAGES[idx + 1] as InterviewStage
}

export function advanceStageIfNeeded(
  current: InterviewStage,
  plan: InterviewPlan,
  progress: InterviewPlanProgress,
): { stage: InterviewStage; progress: InterviewPlanProgress } {
  let stage = current
  let updatedProgress = progress

  while (stage !== 'COMPLETED' && isStageComplete(stage, plan, updatedProgress)) {
    stage = nextStage(stage)
  }

  return { stage, progress: updatedProgress }
}

export function getStageObjective(stage: InterviewStage): string {
  switch (stage) {
    case 'INTRODUCTION':
      return 'Warm welcome, set expectations, ask the candidate to briefly introduce themselves.'
    case 'RESUME_DISCUSSION':
      return 'Discuss resume projects, skills, and experience. Priority: projects > skills > experience.'
    case 'TECHNICAL_ROUND':
      return 'Ask foundational technical questions aligned to the target role.'
    case 'DEEP_TECHNICAL':
      return 'Ask advanced follow-ups that increase depth on strong topics or probe weak areas.'
    case 'BEHAVIORAL_ROUND':
      return 'Ask behavioral and situational questions using STAR-style probing.'
    case 'HR_ROUND':
      return 'Ask culture fit, motivation, and career goal questions.'
    case 'SUMMARY':
      return 'Summarize the interview, highlight key observations, and close professionally.'
    case 'COMPLETED':
      return 'Interview complete.'
    default:
      return ''
  }
}
