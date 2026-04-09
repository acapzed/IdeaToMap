import { Router } from 'express'
import { createSession, getSession, updateSession } from '../store/sessions.js'
import { validateIdea, generateClarifyQuestions, buildConfirmation, generateNextQuestion, generateReport, exploreCategory } from '../services/ollama.js'
import { answerToDelta } from '../services/delta.js'

const router = Router()

// POST /api/sessions
// Body: { idea: string }
router.post('/', async (req, res) => {
  const { idea } = req.body
  if (!idea?.trim()) return res.status(400).json({ error: 'idea is required' })
  if (idea.trim().length < 5) return res.status(400).json({ error: '아이디어를 좀 더 구체적으로 입력해주세요.' })

  try {
    const { valid, reason } = await validateIdea(idea.trim())
    if (!valid) return res.status(400).json({ error: reason ?? '프로젝트 아이디어를 입력해주세요.' })
  } catch {
    // 검사 실패 시 통과 (서비스 중단 방지)
  }

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

// POST /api/sessions/:id/questions — 첫 번째 질문 생성
router.post('/:id/questions', async (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'session not found' })

  let result
  try {
    result = await generateNextQuestion(session.idea, session.confirmation, [])
  } catch (err) {
    console.error('[generateNextQuestion]', err)
    return res.status(500).json({ error: 'AI 호출 실패', detail: err.message })
  }

  const firstQuestion = result.next_question
  if (!firstQuestion) return res.status(500).json({ error: '질문 생성 실패' })

  updateSession(req.params.id, (s) => ({ ...s, questions: [firstQuestion] }))
  res.json({ questions: [firstQuestion], skeleton_nodes: [], skeleton_edges: [] })
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

  // 지금까지의 전체 히스토리 (이번 답변 포함)
  const updatedAnswers = { ...(session.answers[user_id] ?? {}), [question_id]: answer }
  const history = session.questions
    .filter((q) => updatedAnswers[q.id])
    .map((q) => ({ category: q.category, text: q.text, answer: updatedAnswers[q.id] }))

  // 다음 질문 동적 생성 (explore 질문은 제외)
  let next_question = null
  if (!question.is_explore) {
    try {
      const result = await generateNextQuestion(session.idea, session.confirmation, history)
      next_question = result.next_question ?? null
    } catch (err) {
      console.warn('[generateNextQuestion] 실패 (무시):', err.message)
    }
  }

  updateSession(req.params.id, (s) => ({
    ...s,
    answers: {
      ...s.answers,
      [user_id]: updatedAnswers,
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
    questions: next_question && !s.questions.some((q) => q.id === next_question.id)
      ? [...s.questions, next_question]
      : s.questions,
  }))

  res.json({ delta, next_question })
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
