const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export function isOpenAIConfigured() {
  return Boolean(import.meta.env.VITE_OPENAI_API_KEY)
}

async function callOpenAI(prompt, fallback) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) return fallback

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are an interview and resume coach. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) return fallback
    const json = await response.json()
    const text = json?.choices?.[0]?.message?.content
    if (!text) return fallback
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

export async function analyzeResumeWithAI({ resumeText, role = 'SDE', company = 'Amazon' }) {
  const fallback = {
    resumeScore: 72,
    atsScore: 68,
    missingSkills: ['system design', 'testing', 'metrics'],
    weakBullets: ['Bullets are descriptive but not quantified.'],
    companySuggestions: [`For ${company}, emphasize ownership and measurable impact.`],
    roleImprovements: [`For ${role}, include stronger architecture and debugging signals.`],
    betterProjects: ['Built scalable module reducing response time by 30% for 50k monthly users.'],
    betterExperienceBullets: ['Optimized SQL queries, reducing p95 latency from 420ms to 190ms.'],
    missingKeywords: ['latency', 'scalability', 'stakeholder'],
  }

  const prompt = `Analyze this resume for role ${role} at ${company}. Return JSON with keys:
resumeScore, atsScore, missingSkills, weakBullets, companySuggestions, roleImprovements, betterProjects, betterExperienceBullets, missingKeywords.
Resume text:
${resumeText || ''}`

  return callOpenAI(prompt, fallback)
}

export async function optimizeResumeWithAI({ resumeText, role = 'SDE', company = 'Amazon' }) {
  const fallback = {
    optimizedResume: `${resumeText || ''}\n\n- Improved critical API latency by 34% using caching and query tuning.\n- Delivered cross-team feature with measurable business impact and clear ownership.\n`,
    summary: `Optimized for ${company} and ${role} with clearer impact-driven bullets.`,
  }

  const prompt = `Rewrite and optimize this resume for ${role} role targeting ${company}. Return JSON with keys optimizedResume and summary only.
Rules:
- improve wording
- add stronger metrics
- align with company style
Resume:
${resumeText || ''}`

  return callOpenAI(prompt, fallback)
}

export async function generateInterviewFeedbackWithAI({ question, answer, role = 'SDE', company = 'Amazon' }) {
  const fallback = {
    score: 74,
    confidenceScore: 70,
    clarityScore: 72,
    strengths: ['Addresses core question intent.'],
    weaknesses: ['Could include stronger metrics and trade-offs.'],
    suggestions: ['Use clearer structure and add one concrete example.'],
  }

  const prompt = `Evaluate interview answer as JSON with keys:
score, confidenceScore, clarityScore, strengths, weaknesses, suggestions.
Role: ${role}
Company: ${company}
Question: ${question}
Answer: ${answer}`

  return callOpenAI(prompt, fallback)
}

