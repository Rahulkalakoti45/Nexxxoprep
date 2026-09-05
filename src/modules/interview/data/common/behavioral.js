export default [
  {
    id: 'beh-1',
    company: 'common',
    role: 'any',
    round: 'Behavioral',
    domain: 'behavioral',
    difficulty: 'Medium',
    question: 'Tell me about a time you handled a tight deadline with conflicting priorities.',
    expectedConcepts: ['prioritization', 'communication', 'ownership'],
    followUpTemplates: ['What tradeoff did you make?', 'How did you communicate risk?'],
    estimatedTime: 180,
  },
  {
    id: 'beh-2',
    company: 'common',
    role: 'any',
    round: 'Behavioral + Collaboration',
    domain: 'decision making',
    difficulty: 'Medium',
    question: 'Describe a decision you made with incomplete data. What signals did you trust and why?',
    expectedConcepts: ['judgment', 'tradeoffs', 'accountability'],
    followUpTemplates: ['What would you do differently now?', 'How did you measure the outcome?'],
    estimatedTime: 180,
  },
]

