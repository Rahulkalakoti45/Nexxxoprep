const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were',
  'what', 'how', 'why', 'when', 'where', 'can', 'you', 'your', 'tell', 'me', 'about', 'describe',
  'explain', 'walk', 'through', 'please', 'would', 'could', 'do', 'did', 'have', 'has', 'that', 'this',
])

export class QuestionDiversityService {
  extractTopic(text: string): string {
    const tokens = this.tokenize(text)
    const keywords = tokens.filter((t) => t.length > 2 && !STOP_WORDS.has(t))
    return keywords.slice(0, 6).join(' ')
  }

  isSemanticallySimilar(a: string, b: string): boolean {
    const setA = new Set(this.tokenize(a))
    const setB = new Set(this.tokenize(b))
    if (!setA.size || !setB.size) return false
    let overlap = 0
    for (const token of setA) {
      if (setB.has(token)) overlap += 1
    }
    const union = new Set([...setA, ...setB]).size
    const jaccard = overlap / union
    return jaccard >= 0.55
  }

  isDuplicateQuestion(question: string, askedQuestions: string[]): boolean {
    const normalized = question.trim().toLowerCase()
    if (!normalized) return true
    return askedQuestions.some((existing) => {
      const prev = existing.trim().toLowerCase()
      if (prev === normalized) return true
      return this.isSemanticallySimilar(question, existing)
    })
  }

  isTopicCovered(topic: string, coveredTopics: string[]): boolean {
    if (!topic.trim()) return false
    return coveredTopics.some((existing) => this.isSemanticallySimilar(topic, existing))
  }

  registerQuestion(question: string, state: { askedQuestions: string[]; coveredTopics: string[]; questionTopics: string[] }) {
    const topic = this.extractTopic(question)
    if (!state.askedQuestions.includes(question.trim())) {
      state.askedQuestions.push(question.trim())
    }
    if (topic && !state.coveredTopics.includes(topic)) {
      state.coveredTopics.push(topic)
    }
    if (topic && !state.questionTopics.includes(topic)) {
      state.questionTopics.push(topic)
    }
    return topic
  }

  buildAvoidList(askedQuestions: string[], coveredTopics: string[]): string {
    const recentQuestions = askedQuestions.slice(-8)
    const recentTopics = coveredTopics.slice(-10)
    return [
      recentQuestions.length ? `Do NOT repeat these questions:\n- ${recentQuestions.join('\n- ')}` : '',
      recentTopics.length ? `Do NOT revisit these topics/concepts:\n- ${recentTopics.join('\n- ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s+#.]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  }
}
