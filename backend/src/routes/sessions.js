import { Router } from 'express'
import { createSession, getSession, updateSession } from '../store/sessions.js'
import { generateClarifyQuestions, buildConfirmation, generateQuestions, generateFollowUp, generateReport, exploreCategory } from '../services/ollama.js'
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

// POST /api/sessions/:id/confirm
// 아이디어 파악용 대화 질문 생성
router.post('/:id/confirm', async (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  let clarifyQuestions
  try {
    clarifyQuestions = await generateClarifyQuestions(session.idea)
  } catch (err) {
    console.error('[generateClarifyQuestions]', err)
    return res.status(500).json({ error: 'Ollama 호출 실패', detail: err.message })
  }

  updateSession(req.params.id, (s) => ({ ...s, clarifyQuestions, clarifyAnswers: [] }))
  res.json({ clarify_questions: clarifyQuestions })
})

// POST /api/sessions/:id/confirm/done
// 대화 답변 기반으로 요약 생성
router.post('/:id/confirm/done', async (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  const { answers } = req.body  // [{ question, answer }, ...]

  let confirmation
  try {
    confirmation = await buildConfirmation(session.idea, answers)
  } catch (err) {
    console.error('[buildConfirmation]', err)
    return res.status(500).json({ error: 'Ollama 호출 실패', detail: err.message })
  }

  updateSession(req.params.id, (s) => ({ ...s, clarifyAnswers: answers, confirmation }))
  res.json({ confirmation })
})

// POST /api/sessions/:id/questions
// Calls Ollama (prompt A), returns questions + greyed skeleton nodes
router.post('/:id/questions', async (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  let result
  try {
    result = await generateQuestions(session.idea, session.confirmation)
  } catch (err) {
    console.error('[generateQuestions]', err)
    return res.status(500).json({ error: 'Ollama 호출 실패', detail: err.message })
  }

  const { questions } = result

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
router.post('/:id/answers', async (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  const { user_id = 'default', question_id, answer } = req.body
  if (!question_id || !answer) return res.status(400).json({ error: 'question_id and answer required' })

  const question = session.questions.find((q) => q.id === question_id)
  if (!question) return res.status(400).json({ error: 'question not found' })

  const delta = answerToDelta(question, answer)

  const prevAnswers = Object.entries(session.answers[user_id] ?? {}).map(([qid, ans]) => {
    const q = session.questions.find((q) => q.id === qid)
    return q ? { text: q.text, answer: ans } : null
  }).filter(Boolean)

  // follow-up 생성 (원래 질문에 한해)
  let follow_up = null
  if (!question.is_follow_up) {
    try {
      const result = await generateFollowUp(session.idea, prevAnswers, question, answer)
      follow_up = result.follow_up ?? null
    } catch (err) {
      console.warn('[generateFollowUp] 실패 (무시):', err.message)
    }
  }

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
    questions: follow_up && !s.questions.some((q) => q.id === follow_up.id)
      ? [...s.questions, follow_up]
      : s.questions,
  }))

  res.json({ delta, follow_up })
})

// POST /api/sessions/:id/mindmap/enrich
// Calls Ollama (prompt C), adds conflicts + warnings to mindmap
// POST /api/sessions/:id/mindmap/enrich → 종합 리포트 생성
router.post('/:id/mindmap/enrich', async (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  let report
  try {
    report = await generateReport(session)
  } catch (err) {
    console.error('[generateReport]', err)
    return res.status(500).json({ error: 'AI 호출 실패', detail: err.message })
  }

  updateSession(req.params.id, (s) => ({ ...s, report }))
  res.json({ enrichment: report })
})

// POST /api/sessions/:id/explore — 특정 영역 심화 질문 생성
router.post('/:id/explore', async (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  const { topic, existing_answer } = req.body
  if (!topic) return res.status(400).json({ error: 'topic required' })

  let result
  try {
    result = await exploreCategory(session, topic, existing_answer ?? '')
  } catch (err) {
    console.error('[exploreCategory]', err)
    return res.status(500).json({ error: 'AI 호출 실패', detail: err.message })
  }

  // 심화 질문을 세션 questions에 등록
  updateSession(req.params.id, (s) => ({
    ...s,
    questions: [
      ...s.questions,
      ...result.questions.filter((q) => !s.questions.some((sq) => sq.id === q.id)),
    ],
  }))

  res.json({ questions: result.questions })
})

// GET /api/sessions/:id
router.get('/:id', (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })
  res.json(session)
})

export default router
