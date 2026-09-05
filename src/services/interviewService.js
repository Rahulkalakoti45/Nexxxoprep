import { aggregateInterviewFeedback, analyzeAnswer } from '../utils/aiFeedback.js'
import { generateInterviewFeedbackWithAI } from './openaiService.js'
import { buildInterviewIntelligenceReport } from '../utils/reportEngine.js'
import { generateSessionReport } from './backend/reportsApi.js'
import { buildBackendReportPayload } from '../utils/reportMapper.js'
import { markSessionCompleted, recordAnswerBehavior } from './backendSessionSync.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function evaluateAnswer(payload) {
  await delay(250)
  const local = analyzeAnswer(payload.answer, payload.question.type, payload.question.domain)
  if (payload?.config?.mode === 'ai_simulated') {
    const ai = await generateInterviewFeedbackWithAI({
      question: payload.question.question,
      answer: payload.answer,
      role: payload.config.role,
      company: payload.config.company,
    })
    return {
      ...local,
      score: Math.round((local.score + (ai.score || local.score)) / 2),
      confidenceScore: ai.confidenceScore || local.confidenceScore,
      clarityScore: ai.clarityScore || local.clarityScore,
      strengths: [...new Set([...(local.strengths || []), ...(ai.strengths || [])])].slice(0, 4),
      weaknesses: [...new Set([...(local.weaknesses || []), ...(ai.weaknesses || [])])].slice(0, 4),
      suggestions: [...new Set([...(local.suggestions || []), ...(ai.suggestions || [])])].slice(0, 4),
    }
  }
  return local
}

function computeDomainBreakdown(answerEntries) {
  const byDomain = {}

  for (const entry of answerEntries) {
    const domain = entry.question?.domain || 'General'
    const feedback = entry.feedback || {}
    if (!byDomain[domain]) {
      byDomain[domain] = { domain, total: 0, count: 0, answered: 0, skipped: 0, doubtful: 0, weak: 0 }
    }
    byDomain[domain].total += feedback.score || 0
    byDomain[domain].count += 1
    byDomain[domain][entry.status || 'answered'] += 1
    if ((feedback.score || 0) < 60) byDomain[domain].weak += 1
  }

  return Object.values(byDomain)
    .map((item) => ({
      ...item,
      avgScore: item.count ? Math.round(item.total / item.count) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
}

function computePatternAnalysis(answerEntries) {
  const lengths = answerEntries.map((entry) => entry.feedback?.meta?.wordCount ?? entry.answer?.split(/\s+/).filter(Boolean).length ?? 0)
  const averageAnswerLength = lengths.length
    ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
    : 0

  const hesitationSignals = ['maybe', 'not sure', 'i think', 'i guess']
  const hesitationCount = answerEntries.reduce((sum, entry) => {
    const text = (entry.answer || '').toLowerCase()
    const has = hesitationSignals.some((signal) => text.includes(signal))
    return sum + (has ? 1 : 0)
  }, 0)

  const hesitationScore = lengths.length ? Math.round((hesitationCount / lengths.length) * 100) : 0

  const consistencyScore = lengths.length
    ? Math.max(35, Math.round(90 - Math.min(45, Math.abs(65 - averageAnswerLength) * 0.8)))
    : 0

  return {
    averageAnswerLength,
    hesitationScore, // mock percentage of answers with hesitation language
    consistencyScore,
  }
}

function getInterviewLevel(score) {
  if (score >= 85) return { level: 'Strong', recommendation: 'Ready for real interviews with minor polishing.' }
  if (score >= 70) return { level: 'Good', recommendation: 'Interview-ready with targeted improvements in weak areas.' }
  if (score >= 55) return { level: 'Developing', recommendation: 'Focus on fundamentals and structured answers.' }
  return { level: 'Needs Work', recommendation: 'Start with basics, practice daily, and improve clarity and depth.' }
}

function generateRoadmap(weakDomains) {
  const primary = weakDomains[0] || 'General'
  const secondary = weakDomains[1] || 'Communication'

  return {
    dailyPlan: [
      `Day 1-2: Practice 3 questions in ${primary} and review solutions.`,
      `Day 3-4: Improve structure using STAR/Framework; rewrite 3 answers.`,
      `Day 5: Timed mock round (10-15 min) focused on ${secondary}.`,
      'Day 6: Review mistakes and create a cheat-sheet of patterns.',
      'Day 7: Full mixed mock interview and re-check weak areas.',
    ],
    weeklyGoals: [
      `Raise ${primary} average by 10 points with focused drills.`,
      'Increase answer clarity: use a 3-part structure consistently.',
      'Add 2 measurable outcomes/examples per interview.',
    ],
  }
}

export async function generateInterviewReport(interviewData, { userId, backendSessionId } = {}) {
  await delay(300)
  const safeAnswers = Array.isArray(interviewData?.answers) ? interviewData.answers : []
  const safeConfig = interviewData?.config || { role: 'SDE', company: 'General', difficulty: 'Medium' }
  const safeDuration = Number.isFinite(interviewData?.durationSeconds) ? interviewData.durationSeconds : 1
  console.log('[Interview Report Service] input', { answers: safeAnswers.length, config: safeConfig })

  const { overallScore, strengthsSummary, weaknessSummary } =
    aggregateInterviewFeedback(safeAnswers)

  const domainBreakdown = computeDomainBreakdown(safeAnswers)
  const weakDomains = domainBreakdown
    .slice()
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 2)
    .map((item) => item.domain)

  const patternAnalysis = computePatternAnalysis(safeAnswers)
  const { level, recommendation } = getInterviewLevel(overallScore)
  const roadmap = generateRoadmap(weakDomains)
  const intelligence = buildInterviewIntelligenceReport(safeAnswers)
  const followUpPerformance = {
    asked: Number.isFinite(interviewData?.followUpMetrics?.followUpAsked) ? interviewData.followUpMetrics.followUpAsked : 0,
    answered: safeAnswers.filter((entry) => entry.question?.isFollowUp && entry.status !== 'skipped').length,
  }
  const communicationMetrics = {
    clarityAverage: safeAnswers.length
      ? Math.round(safeAnswers.reduce((sum, item) => sum + (item.feedback?.clarityScore || 0), 0) / safeAnswers.length)
      : 0,
    confidenceAverage: safeAnswers.length
      ? Math.round(safeAnswers.reduce((sum, item) => sum + (item.feedback?.confidenceScore || 0), 0) / safeAnswers.length)
      : 0,
  }

  const uiReport = {
    config: safeConfig,
    durationSeconds: safeDuration,
    overallScore,
    level,
    recommendation,
    strengthsSummary,
    weaknessSummary,
    domainBreakdown,
    weakDomains,
    patternAnalysis,
    timing: interviewData?.timing || { totalSeconds: safeDuration, averageQuestionSeconds: 0 },
    followUpPerformance,
    communicationMetrics,
    roadmap: {
      dailyPlan: roadmap.dailyPlan,
      weeklyGoals: roadmap.weeklyGoals,
      monthlyGoals: intelligence.roadmap.monthly,
    },
    intelligence,
    answers: safeAnswers,
    backendSessionId,
  }

  if (backendSessionId && userId) {
    try {
      await markSessionCompleted(backendSessionId)
      await recordAnswerBehavior(backendSessionId, {
        hesitationScore: patternAnalysis.hesitationScore,
        clarityScore: communicationMetrics.clarityAverage,
      })
      const payload = buildBackendReportPayload(userId, uiReport)
      const persisted = await generateSessionReport(backendSessionId, payload)
      return {
        ...uiReport,
        id: persisted.id,
        backendReportId: persisted.id,
        backendSessionId,
        persistedAt: persisted.createdAt,
      }
    } catch (error) {
      console.warn('[Interview Report] backend persist failed', error)
      return {
        ...uiReport,
        backendError: error.message || 'Report saved locally only',
      }
    }
  }

  return uiReport
}
