const company = 'Microsoft'

const rounds = [
  { id: 'ms-r1', label: 'Projects + Resume', domain: 'resume' },
  { id: 'ms-r2', label: 'Coding + OOP', domain: 'coding' },
  { id: 'ms-r3', label: 'System Design', domain: 'system-design' },
  { id: 'ms-r4', label: 'Behavioral + Collaboration', domain: 'behavioral' },
]

const questions = [
  {
    id: 'ms-res-1',
    company,
    role: 'SDE',
    round: 'Projects + Resume',
    domain: 'project',
    difficulty: 'Medium',
    question: 'Walk through a feature you shipped end-to-end. How did you ensure reliability and maintainability?',
    expectedConcepts: ['testing', 'monitoring', 'design', 'ownership'],
    followUpTemplates: ['What was the hardest bug and how did you debug it?', 'What would you refactor now?'],
    estimatedTime: 240,
  },
  {
    id: 'ms-oop-1',
    company,
    role: 'SDE',
    round: 'Coding + OOP',
    domain: 'coding',
    difficulty: 'Medium',
    question: 'Design an object model for a meeting scheduler. Explain key classes, responsibilities, and extensibility.',
    expectedConcepts: ['oop', 'interfaces', 'separation of concerns'],
    followUpTemplates: ['How would you add recurring meetings?', 'Where would you handle validation?'],
    estimatedTime: 330,
  },
  {
    id: 'ms-code-1',
    company,
    role: 'SDE',
    round: 'Coding + OOP',
    domain: 'dsa',
    difficulty: 'Easy',
    question: 'Given a string, determine if it has all unique characters. Discuss tradeoffs.',
    expectedConcepts: ['hash set', 'bitset', 'complexity'],
    followUpTemplates: ['What if the charset is limited?', 'How do you handle Unicode?'],
    estimatedTime: 240,
  },
  {
    id: 'ms-sd-1',
    company,
    role: 'SDE',
    round: 'System Design',
    domain: 'system-design',
    difficulty: 'Hard',
    question: 'Design a file sync service (like OneDrive) focusing on conflict resolution and offline support.',
    expectedConcepts: ['sync', 'conflicts', 'metadata', 'offline'],
    followUpTemplates: ['How do you resolve conflicts deterministically?', 'How do you handle large files?'],
    estimatedTime: 420,
  },
  {
    id: 'ms-beh-1',
    company,
    role: 'SDE',
    round: 'Behavioral + Collaboration',
    domain: 'behavioral',
    difficulty: 'Medium',
    question: 'Tell me about a time you handled a production issue. How did you coordinate and communicate?',
    expectedConcepts: ['incident response', 'communication', 'ownership'],
    followUpTemplates: ['What did you change to prevent recurrence?', 'How did you prioritize fixes?'],
    estimatedTime: 210,
  },
]

export default { company, rounds, questions }

