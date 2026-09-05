export function generateFollowUpQuestion({ question, answer, feedback }) {
  const score = feedback?.score ?? 0
  const baseId = question?.id || 'unknown'
  const domain = question?.domain || 'General'
  const answerText = (answer || '').trim()

  if (!answerText) {
    return {
      id: `${baseId}-followup-empty`,
      question: `You skipped this ${domain} question. Can you share a short 2-3 line attempt?`,
      domain,
      type: 'Follow-up Clarification',
      roundName: question?.roundName || 'Follow-up',
      difficulty: 'Easy',
      expectedKeywords: [],
      followUpQuestions: [],
      scoringHints: ['Attempt quality', 'Basic understanding'],
      expectedAnswer: 'Provide a short structured attempt.',
      isFollowUp: true,
    }
  }

  if (score < 60) {
    return {
      id: `${baseId}-followup-weak`,
      question: `Let us simplify: explain the core idea of your previous answer in plain steps and give one example.`,
      domain,
      type: 'Follow-up Clarification',
      roundName: question?.roundName || 'Follow-up',
      difficulty: 'Easy',
      expectedKeywords: ['example', 'step'],
      followUpQuestions: [],
      scoringHints: ['Clarity improvement', 'Core concept understanding'],
      expectedAnswer: 'Simplified explanation with one practical example.',
      isFollowUp: true,
    }
  }

  if (score >= 80) {
    return {
      id: `${baseId}-followup-strong`,
      question: `Strong answer. Now go deeper: what trade-off or failure mode would you watch for in this approach?`,
      domain,
      type: 'Follow-up Deep Dive',
      roundName: question?.roundName || 'Follow-up',
      difficulty: 'Hard',
      expectedKeywords: ['trade-off', 'risk', 'mitigation'],
      followUpQuestions: [],
      scoringHints: ['Depth', 'Risk awareness'],
      expectedAnswer: 'Advanced trade-off discussion with mitigation strategy.',
      isFollowUp: true,
    }
  }

  return null
}

