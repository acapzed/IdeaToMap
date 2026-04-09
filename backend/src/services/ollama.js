import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
  apiKey: 'ollama',
})

const MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b'

const chat = async (systemPrompt, userPrompt) => {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  })
  return res.choices[0].message.content
}

const parseJSON = (raw) => {
  // Strip markdown code fences if model wraps output
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(cleaned)
}

// Prompt A: idea → structured question list
export const generateQuestions = async (idea) => {
  const system = `
You are a project planning assistant that helps teams reality-check their ideas.
Always respond with valid JSON only. No explanation, no markdown fences.
`.trim()

  const user = `
Generate a structured question set for the following project idea: "${idea}"

Cover these categories in order:
1. purpose      — context (hackathon / capstone / startup / internal / portfolio)
2. team_personas — team roles, experience, availability
3. team_strengths — what the team is good at, gaps
4. problem_users — target users and the core problem
5. features      — must-have vs nice-to-have features
6. constraints   — time, budget, tech limits
7. external_deps — third-party APIs, data sources, hardware
8. deliverables  — demo, docs, deployment format
9. market        — competitors, differentiation
10. business_model — revenue model (or N/A for contests)
11. risks        — biggest unknowns
12. success      — definition of done for v1

Return JSON in this exact shape:
{
  "questions": [
    {
      "id": "q1",
      "category": "purpose",
      "text": "Question text here",
      "options": [
        { "label": "Option A", "trade_off": "short note on implication" },
        { "label": "Option B", "trade_off": "..." }
      ]
    }
  ]
}

Generate 1-2 questions per category. Keep options to 3-4 per question.
`.trim()

  const raw = await chat(system, user)
  return parseJSON(raw)
}

// Prompt C: all answers → enrichment (conflicts, warnings, suggestions)
export const enrichMindmap = async (session) => {
  const system = `
You are a project planning assistant. Analyze a team's answers and identify issues.
Always respond with valid JSON only. No explanation, no markdown fences.
`.trim()

  const user = `
Project idea: "${session.idea}"

Team answers:
${JSON.stringify(session.answers, null, 2)}

Current mindmap nodes:
${JSON.stringify(session.mindmap.nodes, null, 2)}

Identify:
- conflicts: pairs of answers that contradict each other
- warnings: unrealistic combinations (e.g. tight timeline + many features)
- suggestions: specific things the team should reconsider

Return JSON:
{
  "conflicts": [
    { "node_ids": ["n1", "n3"], "reason": "..." }
  ],
  "warnings": [
    { "node_id": "n5", "message": "..." }
  ],
  "suggestions": ["...", "..."]
}
`.trim()

  const raw = await chat(system, user)
  return parseJSON(raw)
}
