import type { InterviewPlan, InterviewPlanProgress } from '@nexoprep/types'

export function createEmptyPlanProgress(): InterviewPlanProgress {
  return {
    introduction: 0,
    resume: 0,
    technical: 0,
    deepTechnical: 0,
    behavioral: 0,
    hr: 0,
    summary: 0,
  }
}

export function generateInterviewPlan(difficulty: string): InterviewPlan {
  const normalized = difficulty.toLowerCase()
  const multiplier = normalized.includes('hard') ? 1.25 : normalized.includes('easy') ? 0.75 : 1

  return {
    resumeQuestions: Math.max(2, Math.round(5 * multiplier)),
    technicalQuestions: Math.max(4, Math.round(8 * multiplier)),
    behavioralQuestions: Math.max(2, Math.round(3 * multiplier)),
    hrQuestions: Math.max(1, Math.round(2 * multiplier)),
  }
}

export function getTotalPlannedQuestions(plan: InterviewPlan): number {
  return (
    1 +
    plan.resumeQuestions +
    plan.technicalQuestions +
    plan.behavioralQuestions +
    plan.hrQuestions +
    1
  )
}

export function getTotalAskedQuestions(progress: InterviewPlanProgress): number {
  return (
    progress.introduction +
    progress.resume +
    progress.technical +
    progress.deepTechnical +
    progress.behavioral +
    progress.hr +
    progress.summary
  )
}

export function formatPlanProgress(plan: InterviewPlan, progress: InterviewPlanProgress): string {
  return [
    `Intro ${progress.introduction}/1`,
    `Resume ${progress.resume}/${plan.resumeQuestions}`,
    `Technical ${progress.technical}/${Math.ceil(plan.technicalQuestions * 0.55)}`,
    `Deep ${progress.deepTechnical}/${Math.max(1, plan.technicalQuestions - Math.ceil(plan.technicalQuestions * 0.55))}`,
    `Behavioral ${progress.behavioral}/${plan.behavioralQuestions}`,
    `HR ${progress.hr}/${plan.hrQuestions}`,
    `Summary ${progress.summary}/1`,
  ].join(' | ')
}
