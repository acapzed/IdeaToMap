// In-memory store — swap to Redis or SQLite when persistence matters
const sessions = new Map()

export const createSession = (idea) => {
  const id = crypto.randomUUID()
  const session = {
    id,
    idea,
    questions: [],
    answers: {},           // { user_id: { question_id: answer, ... } }
    mindmap: {
      nodes: [
        { id: 'root', label: idea, category: 'root', status: 'active' }
      ],
      edges: [],
      conflicts: [],
      warnings: [],
    },
    created_at: new Date().toISOString(),
  }
  sessions.set(id, session)
  return session
}

export const getSession = (id) => sessions.get(id) ?? null

export const updateSession = (id, updater) => {
  const session = sessions.get(id)
  if (!session) return null
  const updated = updater(session)
  sessions.set(id, updated)
  return updated
}
