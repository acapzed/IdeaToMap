const BASE = '/api'

const post = async (url, body) => {
  const r = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  if (!text) throw new Error(`${r.status} 빈 응답 from ${url}`)
  const data = JSON.parse(text)
  if (!r.ok) throw new Error(data.error ?? `${r.status} from ${url}`)
  return data
}

const get = async (url) => {
  const r = await fetch(`${BASE}${url}`)
  const text = await r.text()
  if (!text) throw new Error(`${r.status} 빈 응답 from ${url}`)
  return JSON.parse(text)
}

export const api = {
  createSession: (idea) => post('/sessions', { idea }),
  startConfirm: (sessionId) => post(`/sessions/${sessionId}/confirm`, {}),
  finishConfirm: (sessionId, answers) => post(`/sessions/${sessionId}/confirm/done`, { answers }),
  generateQuestions: (sessionId) => post(`/sessions/${sessionId}/questions`, {}),
  submitAnswer: (sessionId, questionId, answer, userId = 'default') =>
    post(`/sessions/${sessionId}/answers`, { user_id: userId, question_id: questionId, answer }),
  enrichMindmap: (sessionId) => post(`/sessions/${sessionId}/mindmap/enrich`, {}),
  explore: (sessionId, topic, existingAnswer) =>
    post(`/sessions/${sessionId}/explore`, { topic, existing_answer: existingAnswer }),
  getSession: (sessionId) => get(`/sessions/${sessionId}`),
}
