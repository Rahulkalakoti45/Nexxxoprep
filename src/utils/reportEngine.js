function avg(values) {
  if (!values.length) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function buildInterviewIntelligenceReport(answerEntries = []) {
  const scores = answerEntries.map((a) => a.feedback?.score || 0)
  const clarity = answerEntries.map((a) => a.feedback?.clarityScore || 0)
  const confidence = answerEntries.map((a) => a.feedback?.confidenceScore || 0)

  const domainMap = {}
  for (const entry of answerEntries) {
    const domain = entry.question?.domain || 'General'
    if (!domainMap[domain]) domainMap[domain] = []
    domainMap[domain].push(entry.feedback?.score || 0)
  }
  const domainScores = Object.entries(domainMap).map(([domain, list]) => ({ domain, score: avg(list) }))

  const textAnswers = answerEntries.map((a) => (a.answer || '').trim())
  const answerLengths = textAnswers.map((a) => (a ? a.split(/\s+/).length : 0))
  const averageAnswerLength = avg(answerLengths)
  const hesitationWords = ['uh', 'um', 'maybe', 'not sure', 'i think', 'i guess']
  const fillerWords = ['like', 'actually', 'basically', 'literally']

  const hesitationHits = textAnswers.reduce(
    (sum, text) => sum + (hesitationWords.some((w) => text.toLowerCase().includes(w)) ? 1 : 0),
    0,
  )
  const fillerHits = textAnswers.reduce(
    (sum, text) => sum + fillerWords.reduce((acc, w) => acc + (text.toLowerCase().split(w).length - 1), 0),
    0,
  )

  const skippedDomains = [...new Set(answerEntries.filter((a) => a.status === 'skipped').map((a) => a.question?.domain || 'General'))]
  const weakTechnicalAreas = domainScores.filter((d) => d.score < 65).map((d) => d.domain)

  const consistencyScore = clamp(92 - Math.min(45, Math.abs(65 - averageAnswerLength) * 0.9))
  const keywordMatchScore = clamp(avg(answerEntries.map((a) => (a.feedback?.meta?.domainTerms?.length || 0) * 20)))
  const leadershipScore = clamp(avg(answerEntries.filter((a) => ['HR', 'Leadership'].includes(a.question?.domain)).map((a) => a.feedback?.score || 0)) || avg(scores) - 6)
  const problemSolvingScore = clamp(avg(answerEntries.filter((a) => ['DSA', 'Aptitude', 'System Design'].includes(a.question?.domain)).map((a) => a.feedback?.score || 0)) || avg(scores))
  const paceAnalysis = clamp(100 - Math.abs(70 - averageAnswerLength))

  const technicalScore = clamp(avg(answerEntries.filter((a) => ['DSA', 'System Design', 'Backend', 'Aptitude'].includes(a.question?.domain)).map((a) => a.feedback?.score || 0)) || avg(scores))
  const communicationScore = clamp(avg(clarity))
  const confidenceScore = clamp(avg(confidence))

  const weakestDomain = domainScores.slice().sort((a, b) => a.score - b.score)[0]?.domain || 'General'
  const strongestDomain = domainScores.slice().sort((a, b) => b.score - a.score)[0]?.domain || 'General'

  return {
    technicalScore,
    communicationScore,
    confidenceScore,
    domainScores,
    consistencyScore,
    paceAnalysis,
    keywordMatchScore,
    leadershipScore,
    problemSolvingScore,
    patternAnalysis: {
      averageAnswerLength,
      hesitationWordsDetected: hesitationHits,
      fillerWordsDetected: fillerHits,
      skippedDomains,
      weakTechnicalAreas,
    },
    heatmap: {
      strongestDomain,
      weakestDomain,
    },
    roadmap: {
      daily: [
        `Practice 3 focused questions in ${weakestDomain}.`,
        'Record one answer and improve clarity by removing filler words.',
      ],
      weekly: [
        'Complete 2 full mock interviews with time limits.',
        'Raise weakest domain score by at least 8 points.',
      ],
      monthly: [
        'Reach consistent score above 80 in technical rounds.',
        'Build a reusable answer framework for behavioral and design questions.',
      ],
    },
  }
}

