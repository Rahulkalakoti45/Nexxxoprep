import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInterviewerSystemPrompt, buildPracticeFocusBlock, buildProjectDeepDiveBlock } from './interviewer.prompt.js'
import { CandidateProfileService } from '../candidate-profile.service.js'
import { QuestionDiversityService } from '../question-diversity.service.js'
import { createEmptyPlanProgress, generateInterviewPlan } from '../interview-plan.service.js'
import type { ConversationMemory } from '../../conversation/memory.service.js'

function memory(overrides: Partial<ConversationMemory> = {}): ConversationMemory {
  return {
    sessionId: 's1',
    userId: 'u1',
    role: 'Frontend Engineer',
    company: 'Flipkart',
    difficulty: 'medium',
    lifecycle: 'active',
    questionIndex: 0,
    askedQuestions: [],
    topics: [],
    recentTranscript: [],
    updatedAt: '',
    interviewStage: 'TECHNICAL_ROUND',
    interviewPlan: generateInterviewPlan('medium'),
    planProgress: createEmptyPlanProgress(),
    candidateProfile: null,
    coveredTopics: [],
    weakTopics: [],
    strongTopics: [],
    candidateStrengths: [],
    candidateWeaknesses: [],
    answerScores: [],
    questionTopics: [],
    lastAnswerScore: null,
    lastFollowUp: null,
    interviewSummary: null,
    practiceFocus: [],
    previousSessionCount: 0,
    ...overrides,
  } as ConversationMemory
}

const deps = { candidateProfileService: new CandidateProfileService(), questionDiversityService: new QuestionDiversityService() }

test('the prompt names the chosen company, not a hard-coded one', () => {
  const prompt = buildInterviewerSystemPrompt(memory(), deps)
  assert.match(prompt, /reference Flipkart's context/)
  assert.doesNotMatch(prompt, /Amazon/)
})

test('project deep-dive rules apply only while discussing resume and technical work', () => {
  assert.match(buildProjectDeepDiveBlock('RESUME_DISCUSSION', true), /PROJECT DEEP-DIVE/)
  assert.match(buildProjectDeepDiveBlock('DEEP_TECHNICAL', false), /What would break first at 10x/)
  assert.doesNotMatch(buildProjectDeepDiveBlock('DEEP_TECHNICAL', false), /RESUME DATA/)
  assert.equal(buildProjectDeepDiveBlock('HR_ROUND', true), '')
  assert.equal(buildProjectDeepDiveBlock('INTRODUCTION', true), '')
})

test('weak areas from earlier sessions are revisited without mentioning past scores', () => {
  const focus = [{ topic: 'System Design', timesFlagged: 2, lastScore: 4 }, { topic: 'Databases', timesFlagged: 1, lastScore: 5 }]
  const block = buildPracticeFocusBlock(focus, 'TECHNICAL_ROUND')
  assert.match(block, /System Design, Databases/)
  assert.match(block, /Never mention previous sessions/)
  assert.equal(buildPracticeFocusBlock(focus, 'INTRODUCTION'), '')
  assert.equal(buildPracticeFocusBlock([], 'TECHNICAL_ROUND'), '')

  assert.match(buildInterviewerSystemPrompt(memory({ practiceFocus: focus }), deps), /PRACTICE FOCUS/)
  assert.doesNotMatch(buildInterviewerSystemPrompt(memory(), deps), /PRACTICE FOCUS/)
})
