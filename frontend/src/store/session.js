import { create } from 'zustand'

// phase: IDLE | LOADING_QUESTIONS | ANSWERING | ENRICHING | DONE
export const useSessionStore = create((set, get) => ({
  phase: 'IDLE',
  sessionId: null,
  idea: '',
  questions: [],
  currentIndex: 0,
  answers: {},
  tradeOff: null,       // trade-off note for the latest answer
  mindmapNodes: [],
  mindmapEdges: [],
  enrichment: null,     // conflicts, warnings, suggestions from final AI pass

  setPhase: (phase) => set({ phase }),

  // Called after POST /api/sessions
  initSession: (sessionId, rootNode) =>
    set({
      sessionId,
      mindmapNodes: [rootNode],
      mindmapEdges: [],
      phase: 'LOADING_QUESTIONS',
    }),

  // Called after POST /api/sessions/:id/questions
  loadQuestions: (questions, skeletonNodes, skeletonEdges) =>
    set((s) => ({
      questions,
      phase: 'ANSWERING',
      mindmapNodes: [...s.mindmapNodes, ...skeletonNodes],
      mindmapEdges: [...s.mindmapEdges, ...skeletonEdges],
    })),

  // Called after POST /api/sessions/:id/answers
  applyDelta: (questionId, answer, delta) =>
    set((s) => {
      const nextIndex = s.currentIndex + 1
      const done = nextIndex >= s.questions.length
      return {
        answers: { ...s.answers, [questionId]: answer },
        currentIndex: nextIndex,
        tradeOff: delta.trade_off,
        mindmapNodes: [...s.mindmapNodes, ...delta.add_nodes],
        mindmapEdges: [...s.mindmapEdges, ...delta.add_edges],
        phase: done ? 'ENRICHING' : 'ANSWERING',
      }
    }),

  // Called after POST /api/sessions/:id/mindmap/enrich
  applyEnrichment: (enrichment) =>
    set({ enrichment, phase: 'DONE' }),
}))
