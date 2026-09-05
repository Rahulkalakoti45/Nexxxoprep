const company = 'Infosys'

const rounds = [
  { id: 'inf-r1', label: 'Aptitude', domain: 'aptitude' },
  { id: 'inf-r2', label: 'Programming Fundamentals', domain: 'coding' },
  { id: 'inf-r3', label: 'Communication + HR', domain: 'hr' },
]

const questions = [
  {
    id: 'inf-apt-1',
    company,
    role: 'SDE',
    round: 'Aptitude',
    domain: 'aptitude',
    difficulty: 'Easy',
    question: 'Find the next number in the series: 3, 9, 27, 81, ?',
    expectedConcepts: ['pattern', 'geometric progression'],
    followUpTemplates: ['What is the nth term?', 'Give a similar pattern.'],
    estimatedTime: 90,
  },
  {
    id: 'inf-prog-1',
    company,
    role: 'SDE',
    round: 'Programming Fundamentals',
    domain: 'coding',
    difficulty: 'Medium',
    question: 'Explain the difference between stack and heap memory with a real example.',
    expectedConcepts: ['memory', 'lifetime', 'allocation'],
    followUpTemplates: ['How does recursion affect stack?', 'What causes memory leaks?'],
    estimatedTime: 150,
  },
  {
    id: 'inf-hr-1',
    company,
    role: 'SDE',
    round: 'Communication + HR',
    domain: 'hr',
    difficulty: 'Easy',
    question: 'Describe yourself in 60 seconds and explain why Infosys should hire you.',
    expectedConcepts: ['communication', 'motivation', 'fit'],
    followUpTemplates: ['What is one weakness you are improving?', 'How do you handle feedback?'],
    estimatedTime: 150,
  },
]

export default { company, rounds, questions }

