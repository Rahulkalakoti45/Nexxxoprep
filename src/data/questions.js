export const questionBank = [
  {
    role: 'SDE',
    company: 'Amazon',
    difficulty: 'Medium',
    rounds: [
      {
        roundName: 'Technical',
        questions: [
          {
            id: 'sde-amz-tech-1',
            question: 'Implement an LRU cache and explain its time complexity.',
            domain: 'DSA',
            type: 'DSA',
            expectedAnswer: 'Should explain hashmap + doubly linked list with O(1) get and put.',
          },
          {
            id: 'sde-amz-tech-2',
            question: 'Design a URL shortener service. What components and trade-offs would you consider?',
            domain: 'System Design',
            type: 'System Design',
            expectedAnswer:
              'Should discuss API layer, hash generation, database schema, cache, scalability, and collision handling.',
          },
          {
            id: 'sde-amz-tech-3',
            question: 'How would you detect and resolve memory leaks in a Node.js application?',
            domain: 'Backend',
            type: 'Debugging',
            expectedAnswer:
              'Should mention heap snapshots, profiling tools, closure references, event listeners, and cleanup strategy.',
          },
          {
            id: 'sde-amz-tech-4',
            question: 'Explain CAP theorem with a practical distributed system example.',
            domain: 'System Design',
            type: 'Conceptual',
            expectedAnswer: 'Should define consistency, availability, partition tolerance and practical trade-off.',
          },
        ],
      },
      {
        roundName: 'Company-specific',
        questions: [
          {
            id: 'sde-amz-comp-1',
            question: 'How would you make an API idempotent for payment processing?',
            domain: 'Backend',
            type: 'Backend',
            expectedAnswer: 'Should include idempotency keys, dedup checks, transactional consistency.',
          },
          {
            id: 'sde-amz-comp-2',
            question: 'What strategy would you use to handle high write throughput in a logging system?',
            domain: 'System Design',
            type: 'System Design',
            expectedAnswer: 'Should include queue/buffer, batching, stream processing, and storage tiers.',
          },
          {
            id: 'sde-amz-comp-3',
            question: 'How would you design retry logic for flaky external APIs?',
            domain: 'Backend',
            type: 'Backend',
            expectedAnswer: 'Should mention exponential backoff, jitter, circuit breaker, timeout and limits.',
          },
        ],
      },
      {
        roundName: 'Behavioral',
        questions: [
          {
            id: 'sde-amz-beh-1',
            question: 'Describe a time you handled a tight deadline. What trade-offs did you make?',
            domain: 'HR',
            type: 'Behavioral',
            expectedAnswer: 'Should follow STAR, include prioritization and outcome.',
          },
          {
            id: 'sde-amz-beh-2',
            question: 'Tell me about a time you disagreed with a teammate and how you resolved it.',
            domain: 'HR',
            type: 'Behavioral',
            expectedAnswer: 'Should show communication, alignment, and a constructive resolution.',
          },
        ],
      },
    ],
  },
  {
    role: 'SDE',
    company: 'Google',
    difficulty: 'Hard',
    rounds: [
      {
        roundName: 'Technical',
        questions: [
          {
            id: 'sde-goog-tech-1',
            question: 'How would you solve median in a stream of integers?',
            domain: 'DSA',
            type: 'DSA',
            expectedAnswer: 'Should explain two-heaps solution and balancing logic.',
          },
          {
            id: 'sde-goog-tech-2',
            question: 'Design a scalable autocomplete service for millions of daily users.',
            domain: 'System Design',
            type: 'System Design',
            expectedAnswer: 'Should cover trie/indexing, ranking, cache, personalization, and latency constraints.',
          },
          {
            id: 'sde-goog-tech-3',
            question: 'How would you ensure zero-downtime deployments in microservices?',
            domain: 'System Design',
            type: 'DevOps',
            expectedAnswer: 'Should include rolling/canary strategy, health checks and backward compatibility.',
          },
          {
            id: 'sde-goog-tech-4',
            question: 'Design a rate limiter for public APIs.',
            domain: 'System Design',
            type: 'System Design',
            expectedAnswer: 'Should include token bucket/leaky bucket, distributed counters and fairness.',
          },
        ],
      },
      {
        roundName: 'Company-specific',
        questions: [
          {
            id: 'sde-goog-comp-1',
            question: 'How would you secure JWT-based authentication in a web app?',
            domain: 'Backend',
            type: 'Security',
            expectedAnswer: 'Should mention token expiry, refresh rotation, secure storage and revocation.',
          },
          {
            id: 'sde-goog-comp-2',
            question: 'Explain how garbage collection can impact latency-sensitive systems.',
            domain: 'System Design',
            type: 'Runtime',
            expectedAnswer: 'Should discuss pause times, allocation patterns and memory tuning.',
          },
        ],
      },
      {
        roundName: 'Behavioral',
        questions: [
          {
            id: 'sde-goog-beh-1',
            question: 'Describe a time you delivered impact with ambiguous requirements.',
            domain: 'HR',
            type: 'Behavioral',
            expectedAnswer: 'Should show initiative, alignment, and measurable outcome.',
          },
          {
            id: 'sde-goog-beh-2',
            question: 'What is a technical decision you regret? What did you learn?',
            domain: 'HR',
            type: 'Behavioral',
            expectedAnswer: 'Should show reflection, ownership, and improved future approach.',
          },
        ],
      },
    ],
  },
  {
    role: 'HR',
    company: 'General',
    difficulty: 'Medium',
    rounds: [
      {
        roundName: 'Behavioral',
        questions: [
          {
            id: 'hr-1',
            question: 'Tell me about yourself and what drives you professionally.',
            domain: 'HR',
            type: 'Behavioral',
            expectedAnswer: 'Should include concise background, strengths, and motivation aligned to role.',
          },
          {
            id: 'hr-2',
            question: 'Describe a conflict in your team and how you resolved it.',
            domain: 'HR',
            type: 'Behavioral',
            expectedAnswer: 'Should follow STAR format with resolution and learning.',
          },
          {
            id: 'hr-3',
            question: 'Why do you want to join this company?',
            domain: 'HR',
            type: 'Motivation',
            expectedAnswer: 'Should connect candidate goals with company mission and role impact.',
          },
          {
            id: 'hr-4',
            question: 'What is your biggest professional weakness and how are you improving it?',
            domain: 'HR',
            type: 'Self Reflection',
            expectedAnswer: 'Should be honest, specific, and include concrete improvement actions.',
          },
          {
            id: 'hr-5',
            question: 'Describe a time you failed and what you learned from it.',
            domain: 'HR',
            type: 'Behavioral',
            expectedAnswer: 'Should show accountability, learning, and changed behavior.',
          },
          {
            id: 'hr-6',
            question: 'How do you prioritize when multiple deadlines collide?',
            domain: 'HR',
            type: 'Work Style',
            expectedAnswer: 'Should explain decision criteria, communication, and execution approach.',
          },
          {
            id: 'hr-7',
            question: 'Where do you see yourself in the next three years?',
            domain: 'HR',
            type: 'Career Goals',
            expectedAnswer: 'Should show growth plan aligned with business value.',
          },
          {
            id: 'hr-8',
            question: 'How do you handle feedback that you disagree with?',
            domain: 'HR',
            type: 'Communication',
            expectedAnswer: 'Should show openness, clarification, and professional response.',
          },
          {
            id: 'hr-9',
            question: 'Describe a situation where you demonstrated leadership without authority.',
            domain: 'HR',
            type: 'Leadership',
            expectedAnswer: 'Should highlight initiative, influence, and measurable outcome.',
          },
          {
            id: 'hr-10',
            question: 'What values are non-negotiable for you in a workplace?',
            domain: 'HR',
            type: 'Culture Fit',
            expectedAnswer: 'Should define clear values with practical examples.',
          },
        ],
      },
    ],
  },
]
