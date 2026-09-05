export const companyQuestionBank = {
  Amazon: {
    focus: ['Leadership Principles', 'System Design', 'DSA', 'Behavioral'],
    roles: {
      SDE: {
        technical: [
          {
            id: 'amz-sde-tech-1',
            company: 'Amazon',
            role: 'SDE',
            domain: 'DSA',
            difficulty: 'Medium',
            round: 'Technical Skills',
            question: 'Design an algorithm to find top K frequent products in real-time order streams.',
            expectedKeywords: ['heap', 'hash map', 'stream', 'complexity'],
            followUpQuestions: ['How would your design scale to millions of events per minute?'],
            scoringHints: ['Correct data structure', 'Time complexity explanation', 'Scaling strategy'],
          },
          {
            id: 'amz-sde-tech-2',
            company: 'Amazon',
            role: 'SDE',
            domain: 'System Design',
            difficulty: 'Hard',
            round: 'Technical Skills',
            question: 'Design an order-tracking system with low latency status updates.',
            expectedKeywords: ['event-driven', 'queue', 'cache', 'consistency'],
            followUpQuestions: ['How will you handle delayed events and duplicate messages?'],
            scoringHints: ['Component clarity', 'Trade-offs', 'Reliability controls'],
          },
        ],
        company: [
          {
            id: 'amz-sde-comp-1',
            company: 'Amazon',
            role: 'SDE',
            domain: 'Leadership',
            difficulty: 'Medium',
            round: 'Company-Specific Questions',
            question: 'Tell me about a time you took ownership beyond your assigned task.',
            expectedKeywords: ['ownership', 'impact', 'initiative', 'result'],
            followUpQuestions: ['What did you learn and what would you do differently?'],
            scoringHints: ['Ownership signal', 'Impact evidence', 'Reflection'],
          },
        ],
      },
    },
  },
  Google: {
    focus: ['Problem Solving', 'Scalability', 'Communication'],
    roles: {
      SDE: {
        technical: [
          {
            id: 'ggl-sde-tech-1',
            company: 'Google',
            role: 'SDE',
            domain: 'System Design',
            difficulty: 'Hard',
            round: 'Technical Skills',
            question: 'Design a globally distributed URL redirection service.',
            expectedKeywords: ['global load balancing', 'replication', 'latency', 'cache'],
            followUpQuestions: ['How do you reduce cold-cache latency in new regions?'],
            scoringHints: ['Scalability depth', 'Global consistency trade-offs'],
          },
        ],
        company: [
          {
            id: 'ggl-sde-comp-1',
            company: 'Google',
            role: 'SDE',
            domain: 'Problem Solving',
            difficulty: 'Medium',
            round: 'Company-Specific Questions',
            question: 'Explain a complex technical concept to a non-technical stakeholder.',
            expectedKeywords: ['clarity', 'analogy', 'trade-off', 'audience'],
            followUpQuestions: ['How do you validate they understood your explanation?'],
            scoringHints: ['Clarity', 'Audience adaptation'],
          },
        ],
      },
    },
  },
  Microsoft: {
    focus: ['Collaboration', 'Design', 'Execution'],
    roles: {
      SDE: {
        technical: [
          {
            id: 'ms-sde-tech-1',
            company: 'Microsoft',
            role: 'SDE',
            domain: 'Backend',
            difficulty: 'Medium',
            round: 'Technical Skills',
            question: 'How would you design a resilient notification service for enterprise teams?',
            expectedKeywords: ['retry', 'idempotency', 'queue', 'monitoring'],
            followUpQuestions: ['How would you reduce notification duplication?'],
            scoringHints: ['Reliability patterns', 'Operational thinking'],
          },
        ],
      },
    },
  },
  TCS: {
    focus: ['Aptitude', 'Coding', 'HR'],
    roles: {
      SDE: {
        aptitude: [
          {
            id: 'tcs-sde-apt-1',
            company: 'TCS',
            role: 'SDE',
            domain: 'Aptitude',
            difficulty: 'Easy',
            round: 'Problem Solving / Aptitude',
            question: 'A train covers 120 km in 2 hours. What is its average speed?',
            expectedKeywords: ['60', 'km/h'],
            followUpQuestions: ['If speed increases by 20%, what is the new speed?'],
            scoringHints: ['Accuracy', 'Quick reasoning'],
          },
        ],
        company: [
          {
            id: 'tcs-sde-comp-1',
            company: 'TCS',
            role: 'SDE',
            domain: 'HR',
            difficulty: 'Easy',
            round: 'Behavioral + Decision Making',
            question: 'Why do you want to join TCS, and what strengths will you bring?',
            expectedKeywords: ['learning', 'teamwork', 'fundamentals', 'growth'],
            followUpQuestions: ['How would you handle relocation and cross-team projects?'],
            scoringHints: ['Company fit', 'Clarity'],
          },
        ],
      },
    },
  },
  Infosys: {
    focus: ['Fundamentals', 'Coding', 'Communication'],
    roles: {
      SDE: {
        technical: [
          {
            id: 'infy-sde-tech-1',
            company: 'Infosys',
            role: 'SDE',
            domain: 'DSA',
            difficulty: 'Easy',
            round: 'Technical Skills',
            question: 'What is the difference between array and linked list?',
            expectedKeywords: ['memory', 'insertion', 'access time'],
            followUpQuestions: ['Which one would you use for frequent insertions and why?'],
            scoringHints: ['Core fundamentals', 'Use-case reasoning'],
          },
        ],
      },
    },
  },
  Wipro: {
    focus: ['Aptitude', 'Coding Basics', 'HR'],
    roles: {
      SDE: {
        aptitude: [
          {
            id: 'wipro-sde-apt-1',
            company: 'Wipro',
            role: 'SDE',
            domain: 'Aptitude',
            difficulty: 'Easy',
            round: 'Problem Solving / Aptitude',
            question: 'If a number is divisible by 6, what two conditions must be true?',
            expectedKeywords: ['divisible by 2', 'divisible by 3'],
            followUpQuestions: ['Give an example and validate quickly.'],
            scoringHints: ['Accuracy', 'Fundamental logic'],
          },
        ],
      },
    },
  },
}

