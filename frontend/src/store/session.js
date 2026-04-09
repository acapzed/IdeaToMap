import { create } from 'zustand'

// phase: IDLE | CONFIRMING | LOADING_QUESTIONS | ANSWERING | ENRICHING | DONE
export const useSessionStore = create((set) => ({
  phase: 'IDLE',
  sessionId: null,
  idea: '',
  clarifyQuestions: [],   // 아이디어 파악용 대화 질문
  clarifyAnswers: [],     // [{ question, answer }, ...]
  clarifyIndex: 0,
  confirmation: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  tradeOff: null,
  mindmapNodes: [],
  mindmapEdges: [],
  enrichment: null,

  setPhase: (phase) => set({ phase }),

  // POST /api/sessions 후
  initSession: (sessionId, idea, rootNode) =>
    set({
      sessionId,
      idea,
      mindmapNodes: [rootNode],
      mindmapEdges: [],
      phase: 'CONFIRMING',
    }),

  // POST /api/sessions/:id/confirm 후 — 대화 질문 저장
  setClarifyQuestions: (questions) =>
    set({ clarifyQuestions: questions, clarifyIndex: 0, clarifyAnswers: [] }),

  // 대화 답변 하나 추가
  addClarifyAnswer: (question, answer) =>
    set((s) => ({
      clarifyAnswers: [...s.clarifyAnswers, { question, answer }],
      clarifyIndex: s.clarifyIndex + 1,
    })),

  // POST /api/sessions/:id/confirm/done 후
  setConfirmation: (confirmation) =>
    set({ confirmation }),

  // POST /api/sessions/:id/questions 후
  loadQuestions: (questions, skeletonNodes, skeletonEdges) =>
    set((s) => ({
      questions,
      phase: 'ANSWERING',
      mindmapNodes: [...s.mindmapNodes, ...skeletonNodes],
      mindmapEdges: [...s.mindmapEdges, ...skeletonEdges],
    })),

  // POST /api/sessions/:id/answers 후
  applyDelta: (questionId, answer, delta, nextQuestion = null) =>
    set((s) => {
      // 다음 질문이 있으면 큐에 추가
      const updatedQuestions = nextQuestion && !s.questions.some((q) => q.id === nextQuestion.id)
        ? [...s.questions, nextQuestion]
        : s.questions

      const nextIndex = s.currentIndex + 1
      // next_question이 null이면 AI가 완료 판단 → ENRICHING으로 (QAFlow에서 처리)
      return {
        answers: { ...s.answers, [questionId]: answer },
        questions: updatedQuestions,
        currentIndex: nextIndex,
        tradeOff: delta.trade_off,
        mindmapNodes: [...s.mindmapNodes, ...delta.add_nodes],
        mindmapEdges: [...s.mindmapEdges, ...delta.add_edges],
        phase: 'ANSWERING',
      }
    }),

  applyFollowUp: (followUp) =>
    set((s) => {
      if (!followUp || s.phase !== 'ANSWERING') return s
      const already = s.questions.find((q) => q.id === followUp.id)
      if (already) return s
      return {
        questions: [...s.questions, followUp],
      }
    }),

  // POST /api/sessions/:id/mindmap/enrich 후
  applyEnrichment: (enrichment) =>
    set({ enrichment, phase: 'DONE' }),

  // POST /api/sessions/:id/explore 후 — 심화 질문을 현재 위치에 삽입
  loadExploreQuestions: (newQuestions) =>
    set((s) => ({
      questions: [
        ...s.questions,
        ...newQuestions.filter((q) => !s.questions.some((sq) => sq.id === q.id)),
      ],
      phase: 'ANSWERING',
      currentIndex: s.questions.length, // 기존 질문 끝 다음부터
    })),

  // 다시 시작
  reset: () =>
    set({
      phase: 'IDLE',
      sessionId: null,
      idea: '',
      clarifyQuestions: [],
      clarifyAnswers: [],
      clarifyIndex: 0,
      confirmation: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      tradeOff: null,
      mindmapNodes: [],
      mindmapEdges: [],
      enrichment: null,
    }),
}))
