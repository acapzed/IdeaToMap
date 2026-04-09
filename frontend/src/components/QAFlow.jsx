import { useState } from 'react'
import { api } from '../api/client.js'
import { useSessionStore } from '../store/session.js'

export default function QAFlow() {
  const { sessionId, questions, currentIndex, tradeOff, applyDelta, applyFollowUp, applyEnrichment, setPhase, phase } =
    useSessionStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [customInput, setCustomInput] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const question = questions[currentIndex]

  const handleAnswer = async (answer) => {
    if (loading || !answer.trim()) return
    setLoading(true)
    setError(null)
    setCustomInput('')
    setShowCustom(false)

    try {
      const { delta, follow_up } = await api.submitAnswer(sessionId, question.id, answer)
      applyDelta(question.id, answer, delta, null)

      if (follow_up) applyFollowUp(follow_up)

      const isLast = currentIndex + 1 >= questions.length
      if (isLast) {
        const { enrichment } = await api.enrichMindmap(sessionId)
        applyEnrichment(enrichment)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'LOADING_QUESTIONS') {
    return (
      <div className="p-6 h-full flex flex-col justify-center items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">질문 생성 중...</p>
      </div>
    )
  }

  if (phase === 'ENRICHING') {
    return (
      <div className="p-6 h-full flex flex-col justify-center items-center gap-3">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">마인드맵 분석 중...</p>
      </div>
    )
  }

  if (phase === 'DONE') {
    return (
      <div className="p-6 h-full flex flex-col justify-center items-center gap-3">
        <div className="text-4xl">✓</div>
        <p className="text-sm font-medium text-gray-700">마인드맵 완성!</p>
        <p className="text-xs text-gray-400 text-center">오른쪽에서 결과를 확인하세요.</p>
      </div>
    )
  }

  if (!question) return null

  const progress = Math.round((currentIndex / questions.length) * 100)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 진행바 */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>{currentIndex} / {questions.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6 flex-1">
        {/* 카테고리 뱃지 */}
        <span className="text-xs bg-blue-50 text-blue-500 rounded-full px-3 py-1 w-fit font-medium">
          {CATEGORY_LABELS[question.category] ?? question.category}
        </span>

        {/* 질문 */}
        <p className="text-sm font-semibold text-gray-800 leading-relaxed">{question.text}</p>

        {/* 이전 답변의 trade-off 노트 */}
        {tradeOff && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 leading-relaxed">
            💡 {tradeOff}
          </div>
        )}

        {/* 선택지 */}
        <div className="flex flex-col gap-2">
          {question.options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleAnswer(opt.label)}
              disabled={loading}
              className="text-left rounded-xl p-3 text-sm disabled:opacity-40 transition-colors group border border-gray-200 hover:bg-blue-50 hover:border-blue-300"
            >
              <span className="text-gray-700 group-hover:text-blue-700">{opt.label}</span>
              {opt.trade_off && (
                <span className="block text-xs text-gray-400 mt-0.5 group-hover:text-blue-400">
                  → {opt.trade_off}
                </span>
              )}
            </button>
          ))}

          {/* 직접 입력 */}
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              disabled={loading}
              className="text-left border border-dashed border-gray-300 rounded-xl p-3 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-400 disabled:opacity-40 transition-colors"
            >
              + 직접 입력
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnswer(customInput)}
                placeholder="직접 입력..."
                autoFocus
                className="flex-1 border border-blue-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={() => handleAnswer(customInput)}
                disabled={!customInput.trim() || loading}
                className="bg-blue-600 text-white rounded-xl px-4 text-sm disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-xs bg-red-50 rounded-lg p-2">{error}</p>
        )}
      </div>
    </div>
  )
}


const CATEGORY_LABELS = {
  purpose:        '목적 / 맥락',
  team_personas:  '팀 구성',
  team_strengths: '강점 & 약점',
  problem_users:  '문제 & 대상',
  features:       '기능',
  constraints:    '제약 조건',
  external_deps:  '외부 의존성',
  deliverables:   '산출물',
  market:         '시장 & 경쟁',
  business_model: '비즈니스 모델',
  risks:          '리스크',
  success:        '성공 기준',
}
