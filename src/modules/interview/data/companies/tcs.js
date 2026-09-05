const company = 'TCS'

const rounds = [
  { id: 'tcs-r1', label: 'Aptitude + Reasoning', domain: 'aptitude' },
  { id: 'tcs-r2', label: 'CS Fundamentals', domain: 'coding' },
  { id: 'tcs-r3', label: 'HR + Communication', domain: 'hr' },
]

const questions = [
  {
    id: 'tcs-apt-1',
    company,
    role: 'SDE',
    round: 'Aptitude + Reasoning',
    domain: 'aptitude',
    difficulty: 'Easy',
    question: 'A can do a work in 12 days and B in 18 days. How many days to finish together?',
    expectedConcepts: ['work-rate', 'fractions'],
    followUpTemplates: ['Explain the method.', 'How would you handle 3 workers?'],
    estimatedTime: 150,
  },
  {
    id: 'tcs-cs-1',
    company,
    role: 'SDE',
    round: 'CS Fundamentals',
    domain: 'coding',
    difficulty: 'Medium',
    question: 'Explain normalization and when denormalization makes sense in real systems.',
    expectedConcepts: ['normal forms', 'tradeoffs', 'performance'],
    followUpTemplates: ['Give a practical schema example.', 'How do indexes affect this decision?'],
    estimatedTime: 180,
  },
  {
    id: 'tcs-hr-1',
    company,
    role: 'SDE',
    round: 'HR + Communication',
    domain: 'hr',
    difficulty: 'Easy',
    question: 'Why do you want to join TCS and what will you do in your first 6 months?',
    expectedConcepts: ['motivation', 'clarity', 'communication'],
    followUpTemplates: ['How do you handle routine tasks?', 'What are your long-term goals?'],
    estimatedTime: 150,
  },
]

export default { company, rounds, questions }

