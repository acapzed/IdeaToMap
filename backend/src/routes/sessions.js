import { Router } from 'express'
import { createSession, getSession, updateSession } from '../store/sessions.js'
import { generateQuestions, enrichMindmap } from '../services/ollama.js'
import { answerToDelta } from '../services/delta.js'

const router = Router()

// POST /api/sessions
// Body: { idea: string }
router.post('/', (req, res) => {
  const { idea } = req.body
  if (!idea?.trim()) return res.status(400).json({ error: 'idea is required' })

  const session = createSession(idea.trim())
  res.json({ session_id: session.id, mindmap: session.mindmap })
})

// POST /api/sessions/:id/questions
// Calls Ollama (prompt A), returns questions + greyed skeleton nodes
router.post('/:id/questions', async (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  const { questions } = await generateQuestions(session.idea)

  // Build greyed-out skeleton category nodes from question categories
  const seen = new Set()
  const skeletonNodes = []
  const skeletonEdges = []

  for (const q of questions) {
    if (seen.has(q.category)) continue
    seen.add(q.category)

    const nodeId = `cat_${q.category}`
    skeletonNodes.push({ id: nodeId, label: q.category, category: q.category, status: 'greyed' })
    skeletonEdges.push({ id: `e_root_${nodeId}`, source: 'root', target: nodeId })
  }

  updateSession(req.params.id, (s) => ({
    ...s,
    questions,
    mindmap: {
      ...s.mindmap,
      nodes: [...s.mindmap.nodes, ...skeletonNodes],
      edges: [...s.mindmap.edges, ...skeletonEdges],
    },
  }))

  res.json({ questions, skeleton_nodes: skeletonNodes, skeleton_edges: skeletonEdges })
})

// POST /api/sessions/:id/answers
// Body: { user_id: string, question_id: string, answer: string }
// Rule-based delta — no AI call, instant response
router.post('/:id/answers', (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  const { user_id = 'default', question_id, answer } = req.body
  if (!question_id || !answer) return res.status(400).json({ error: 'question_id and answer required' })

  const question = session.questions.find((q) => q.id === question_id)
  if (!question) return res.status(400).json({ error: 'question not found' })

  const delta = answerToDelta(question, answer)

  updateSession(req.params.id, (s) => ({
    ...s,
    answers: {
      ...s.answers,
      [user_id]: { ...(s.answers[user_id] ?? {}), [question_id]: answer },
    },
    mindmap: {
      ...s.mindmap,
      nodes: [
        ...s.mindmap.nodes.map((n) =>
          n.id === `cat_${question.category}` ? { ...n, status: 'active' } : n
        ),
        ...delta.add_nodes,
      ],
      edges: [...s.mindmap.edges, ...delta.add_edges],
    },
  }))

  res.json({ delta })
})

// POST /api/sessions/:id/mindmap/enrich
// Calls Ollama (prompt C), adds conflicts + warnings to mindmap
router.post('/:id/mindmap/enrich', async (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  const enrichment = await enrichMindmap(session)

  updateSession(req.params.id, (s) => ({
    ...s,
    mindmap: {
      ...s.mindmap,
      conflicts: enrichment.conflicts ?? [],
      warnings: enrichment.warnings ?? [],
      suggestions: enrichment.suggestions ?? [],
    },
  }))

  res.json({ enrichment })
})

// GET /api/sessions/:id
router.get('/:id', (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })
  res.json(session)
})

export default router
