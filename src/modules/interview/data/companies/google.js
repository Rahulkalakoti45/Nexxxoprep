const company = 'Google'

const rounds = [
  { id: 'ggl-r1', label: 'Resume Deep Dive', domain: 'resume' },
  { id: 'ggl-r2', label: 'Algorithms + DSA', domain: 'dsa' },
  { id: 'ggl-r3', label: 'Scalability + Architecture', domain: 'system-design' },
  { id: 'ggl-r4', label: 'Behavioral + Problem Solving', domain: 'behavioral' },
]

const questions = [
  {
    id: 'ggl-res-1',
    company,
    role: 'SDE',
    round: 'Resume Deep Dive',
    domain: 'resume',
    difficulty: 'Medium',
    question: 'Pick one resume bullet and explain the technical depth behind it (design choices, tradeoffs, validation).',
    expectedConcepts: ['tradeoffs', 'validation', 'metrics'],
    followUpTemplates: ['What alternatives did you consider?', 'How did you test it at scale?'],
    estimatedTime: 240,
  },
  {
    id: 'ggl-algo-1',
    company,
    role: 'SDE',
    round: 'Algorithms + DSA',
    domain: 'dsa',
    difficulty: 'Hard',
    question: 'Given a weighted graph, find the k shortest paths between two nodes. Outline approach and complexity.',
    expectedConcepts: ['graphs', 'heaps', 'complexity', 'correctness'],
    followUpTemplates: ['How do you handle cycles?', 'How would you test edge cases?'],
    estimatedTime: 360,
  },
  {
    id: 'ggl-arch-1',
    company,
    role: 'SDE',
    round: 'Scalability + Architecture',
    domain: 'system-design',
    difficulty: 'Hard',
    question: 'Design a globally distributed notification service with low latency and deduplication.',
    expectedConcepts: ['pubsub', 'partitioning', 'deduplication', 'observability'],
    followUpTemplates: ['How do you avoid duplicates?', 'How do you handle backpressure?'],
    estimatedTime: 420,
  },
  {
    id: 'ggl-beh-1',
    company,
    role: 'SDE',
    round: 'Behavioral + Problem Solving',
    domain: 'behavioral',
    difficulty: 'Medium',
    question: 'Describe a time you influenced without authority. How did you align stakeholders?',
    expectedConcepts: ['influence', 'communication', 'collaboration'],
    followUpTemplates: ['What blockers did you face?', 'How did you measure success?'],
    estimatedTime: 210,
  },
]

export default { company, rounds, questions }

