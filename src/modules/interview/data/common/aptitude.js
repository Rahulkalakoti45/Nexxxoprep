export default [
  {
    id: 'apt-1',
    company: 'common',
    role: 'any',
    round: 'Aptitude + Reasoning',
    domain: 'aptitude',
    difficulty: 'Easy',
    question: 'A train 120m long crosses a pole in 6 seconds. What is its speed in km/h?',
    expectedConcepts: ['speed-distance-time', 'unit conversion'],
    followUpTemplates: ['Solve it in one line.', 'How do you verify quickly?'],
    estimatedTime: 120,
  },
  {
    id: 'apt-2',
    company: 'common',
    role: 'any',
    round: 'Aptitude',
    domain: 'aptitude',
    difficulty: 'Medium',
    question: 'If A can do a work in 12 days and B in 18 days, how many days together?',
    expectedConcepts: ['work-rate', 'fractions'],
    followUpTemplates: ['Explain the rate method.', 'How would you handle 3 people?'],
    estimatedTime: 150,
  },
]

