import { useState } from 'react'
import { api } from '../api/client.js'
import { useSessionStore } from '../store/session.js'

export default function IdeaInput() {
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const { initSession, loadQuestions, setPhase } = useSessionStore()

  const handleStart = async () => {
    if (!idea.trim()) return
    setLoading(true)

    // 1. Create session → root node
    const { session_id, mindmap } = await api.createSession(idea)
    initSession(session_id, mindmap.nodes[0])

    // 2. Generate questions → skeleton nodes
    const { questions, skeleton_nodes, skeleton_edges } = await api.generateQuestions(session_id)
    loadQuestions(questions, skeleton_nodes, skeleton_edges)

    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full justify-center">
      <h1 className="text-2xl font-bold">DevMindmap</h1>
      <p className="text-gray-500 text-sm">
        한 줄로 아이디어를 입력하면, AI가 현실적인 계획으로 다듬어드립니다.
      </p>
      <textarea
        className="border rounded-lg p-3 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="예: 병원 예약을 간편하게 해주는 앱"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
      />
      <button
        onClick={handleStart}
        disabled={loading || !idea.trim()}
        className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? '질문 생성 중...' : '시작하기'}
      </button>
    </div>
  )
}
