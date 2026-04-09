const BASE = '/api'

const post = (url, body) =>
  fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json())

const get = (url) => fetch(`${BASE}${url}`).then((r) => r.json())

export const api = {
  createSession: (idea) => post('/sessions', { idea }),
  generateQuestions: (sessionId) => post(`/sessions/${sessionId}/questions`, {}),
  submitAnswer: (sessionId, questionId, answer, userId = 'default') =>
    post(`/sessions/${sessionId}/answers`, { user_id: userId, question_id: questionId, answer }),
  enrichMindmap: (sessionId) => post(`/sessions/${sessionId}/mindmap/enrich`, {}),
  getSession: (sessionId) => get(`/sessions/${sessionId}`),
}
