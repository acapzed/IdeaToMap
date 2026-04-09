import { useState } from 'react'
import { api } from '../api/client.js'
import { useSessionStore } from '../store/session.js'

export default function IdeaInput() {
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { initSession, setClarifyQuestions } = useSessionStore()

  const handleStart = async () => {
    if (!idea.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { session_id, mindmap } = await api.createSession(idea)
      initSession(session_id, idea, mindmap.nodes[0])

      const { clarify_questions } = await api.startConfirm(session_id)
      setClarifyQuestions(clarify_questions)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full justify-center">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">IdeaToMap</h1>
        <p className="text-gray-400 text-sm mt-1">
          아이디어를 한 줄로 입력하면 AI가 현실적인 계획으로 다듬어드립니다.
        </p>
      </div>

      <textarea
        className="border border-gray-200 rounded-xl p-3 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
        placeholder="예: 병원 예약을 간편하게 해주는 앱"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.metaKey && handleStart()}
      />

      <button
        onClick={handleStart}
        disabled={loading || !idea.trim()}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40 transition-colors"
      >
        {loading ? '분석 중...' : '시작하기 →'}
      </button>

      {loading && (
        <p className="text-xs text-gray-400 text-center leading-relaxed">
          AI가 아이디어를 분석하고 있습니다.<br />
          최초 실행 시 모델 로딩으로 1~2분 소요될 수 있습니다.
        </p>
      )}

      {error && (
        <p className="text-red-500 text-xs bg-red-50 rounded-lg p-2">{error}</p>
      )}
    </div>
  )
}
