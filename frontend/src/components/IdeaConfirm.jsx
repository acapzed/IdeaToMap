import { useState } from 'react'
import { api } from '../api/client.js'
import { useSessionStore } from '../store/session.js'

export default function IdeaConfirm() {
  const {
    sessionId, idea,
    clarifyQuestions, clarifyAnswers, clarifyIndex,
    confirmation,
    addClarifyAnswer, setConfirmation,
    loadQuestions, reset, setPhase,
  } = useSessionStore()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isDone = clarifyIndex >= clarifyQuestions.length
  const currentQ = clarifyQuestions[clarifyIndex]
  const progress = clarifyQuestions.length
    ? Math.round((clarifyIndex / clarifyQuestions.length) * 100)
    : 0

  // 답변 제출
  const handleAnswer = async () => {
    if (!input.trim() || loading) return
    const answer = input.trim()
    setInput('')
    addClarifyAnswer(currentQ, answer)

    // 마지막 질문 답변 → 요약 생성
    if (clarifyIndex + 1 >= clarifyQuestions.length) {
      setLoading(true)
      setError(null)
      try {
        const allAnswers = [...clarifyAnswers, { question: currentQ, answer }]
        const { confirmation } = await api.finishConfirm(sessionId, allAnswers)
        setConfirmation(confirmation)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  // 본 Q&A 시작
  const handleProceed = async () => {
    setLoading(true)
    setError(null)
    try {
      setPhase('LOADING_QUESTIONS')
      const { questions, skeleton_nodes, skeleton_edges } = await api.generateQuestions(sessionId)
      loadQuestions(questions, skeleton_nodes, skeleton_edges)
    } catch (err) {
      setError(err.message)
      setPhase('CONFIRMING')
    } finally {
      setLoading(false)
    }
  }

  // ── 요약 화면 (모든 질문 답변 완료 후)
  if (isDone && confirmation) {
    return (
      <div className="flex flex-col gap-4 p-6 h-full overflow-y-auto">
        <div>
          <span className="text-xs font-semibold text-green-500 uppercase tracking-wide">아이디어 정리 완료</span>
          <h2 className="text-lg font-bold text-gray-800 mt-1">이렇게 이해했습니다</h2>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs text-blue-400 font-medium mb-1">요약</p>
            <p className="text-gray-700 leading-relaxed">{confirmation.summary}</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <InfoRow label="핵심 문제" value={confirmation.core_problem} />
            <InfoRow label="대상 사용자" value={confirmation.target_user} />
            <InfoRow label="다듬은 아이디어" value={confirmation.refined_idea} color="amber" />
          </div>
          {confirmation.key_assumptions?.length > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-xs text-purple-400 font-medium mb-2">검증이 필요한 가정</p>
              {confirmation.key_assumptions.map((a, i) => (
                <p key={i} className="text-gray-700 text-xs mb-1">• {a}</p>
              ))}
            </div>
          )}
          {confirmation.similar_services?.length > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-xs text-green-500 font-medium mb-2">유사 서비스</p>
              <div className="flex flex-wrap gap-1.5">
                {confirmation.similar_services.map((s, i) => (
                  <span key={i} className="bg-white border border-green-200 text-green-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-xs bg-red-50 rounded-lg p-2">{error}</p>}

        <div className="flex gap-2 mt-auto pt-2">
          <button onClick={reset} className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-2.5 text-sm hover:bg-gray-50">
            ← 처음으로
          </button>
          <button
            onClick={handleProceed}
            disabled={loading}
            className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40"
          >
            {loading ? '생성 중...' : '기획 시작 →'}
          </button>
        </div>
      </div>
    )
  }

  // ── 로딩 (요약 생성 중)
  if (isDone && !confirmation) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">대화 내용을 정리하고 있습니다...</p>
      </div>
    )
  }

  // ── 대화 질문 화면
  return (
    <div className="flex flex-col h-full">
      {/* 대화 히스토리 */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">아이디어 파악</span>
          <p className="text-xs text-gray-400 mt-0.5">몇 가지 여쭤볼게요</p>
        </div>

        {/* 아이디어 버블 */}
        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 self-start max-w-[85%]">
          <p className="text-xs text-gray-400 mb-0.5">입력한 아이디어</p>
          <p className="text-sm text-gray-700">{idea}</p>
        </div>

        {/* 이전 Q&A 히스토리 */}
        {clarifyAnswers.map((qa, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 self-start max-w-[85%]">
              <p className="text-sm text-gray-700">{qa.question}</p>
            </div>
            <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-3 self-end max-w-[85%]">
              <p className="text-sm text-white">{qa.answer}</p>
            </div>
          </div>
        ))}

        {/* 현재 질문 */}
        {currentQ && (
          <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 self-start max-w-[85%]">
            <p className="text-sm text-gray-700">{currentQ}</p>
          </div>
        )}
      </div>

      {/* 진행바 + 입력창 */}
      <div className="border-t border-gray-100 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-gray-400">{clarifyIndex}/{clarifyQuestions.length}</span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
            placeholder="답변을 입력하세요..."
            autoFocus
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleAnswer}
            disabled={!input.trim() || loading}
            className="bg-blue-600 text-white rounded-xl px-4 text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}

        <button onClick={reset} className="text-xs text-gray-300 hover:text-gray-400 text-center">
          처음으로 돌아가기
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, color = 'gray' }) {
  const colors = {
    gray:  'bg-gray-50 border-gray-100',
    amber: 'bg-amber-50 border-amber-100',
  }
  return (
    <div className={`border rounded-xl p-3 ${colors[color]}`}>
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  )
}
