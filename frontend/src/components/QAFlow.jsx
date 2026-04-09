import { useState } from 'react'
import { api } from '../api/client.js'
import { useSessionStore } from '../store/session.js'

export default function QAFlow() {
  const { sessionId, questions, currentIndex, tradeOff, applyDelta, applyEnrichment, phase } =
    useSessionStore()
  const [loading, setLoading] = useState(false)

  const question = questions[currentIndex]

  const handleAnswer = async (answer) => {
    if (loading) return
    setLoading(true)

    const { delta } = await api.submitAnswer(sessionId, question.id, answer)
    applyDelta(question.id, answer, delta)

    // If all questions answered, trigger enrichment
    if (currentIndex + 1 >= questions.length) {
      const { enrichment } = await api.enrichMindmap(sessionId)
      applyEnrichment(enrichment)
    }

    setLoading(false)
  }

  if (phase === 'LOADING_QUESTIONS') {
    return <div className="p-6 text-gray-400 text-sm animate-pulse">질문 생성 중...</div>
  }

  if (!question) return null

  return (
    <div className="flex flex-col gap-4 p-6 h-full overflow-y-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <div
          className="h-1 bg-blue-400 rounded transition-all"
          style={{ width: `${((currentIndex) / questions.length) * 100}%`, minWidth: 4 }}
        />
        {currentIndex} / {questions.length}
      </div>

      {/* Category badge */}
      <span className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5 w-fit">
        {question.category}
      </span>

      {/* Question */}
      <p className="text-sm font-medium leading-relaxed">{question.text}</p>

      {/* Trade-off note from previous answer */}
      {tradeOff && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
          💡 {tradeOff}
        </div>
      )}

      {/* Options */}
      <div className="flex flex-col gap-2">
        {question.options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => handleAnswer(opt.label)}
            disabled={loading}
            className="text-left border rounded-lg p-3 text-sm hover:bg-blue-50 hover:border-blue-400 disabled:opacity-50 transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
