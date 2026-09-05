const company = 'Wipro'

const rounds = [
  { id: 'wip-r1', label: 'Aptitude', domain: 'aptitude' },
  { id: 'wip-r2', label: 'Programming Fundamentals', domain: 'coding' },
  { id: 'wip-r3', label: 'Communication + HR', domain: 'hr' },
]

const questions = [
  {
    id: 'wip-apt-1',
    company,
    role: 'SDE',
    round: 'Aptitude',
    domain: 'aptitude',
    difficulty: 'Medium',
    question: 'If a and b are in ratio 3:5 and a+b=64, find a and b.',
    expectedConcepts: ['ratios', 'algebra'],
    followUpTemplates: ['Explain your steps.', 'How would you solve it mentally?'],
    estimatedTime: 120,
  },
  {
    id: 'wip-prog-1',
    company,
    role: 'SDE',
    round: 'Programming Fundamentals',
    domain: 'coding',
    difficulty: 'Medium',
    question: 'What is the difference between HTTP and HTTPS, and why does TLS matter?',
    expectedConcepts: ['security', 'tls', 'certificates'],
    followUpTemplates: ['Explain the handshake at a high level.', 'What is certificate pinning?'],
    estimatedTime: 150,
  },
  {
    id: 'wip-hr-1',
    company,
    role: 'SDE',
    round: 'Communication + HR',
    domain: 'hr',
    difficulty: 'Easy',
    question: 'Why Wipro, and how do you handle working in teams with different opinions?',
    expectedConcepts: ['teamwork', 'communication', 'fit'],
    followUpTemplates: ['Give a real example.', 'How do you resolve conflicts?'],
    estimatedTime: 150,
  },
]

export default { company, rounds, questions }

