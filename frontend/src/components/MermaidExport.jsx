import { useState } from 'react'
import { toMermaid, getMermaidLiveUrl } from '../utils/mermaid.js'
import { useSessionStore } from '../store/session.js'

export default function MermaidExport({ onClose }) {
  const { mindmapNodes, mindmapEdges } = useSessionStore()
  const [copied, setCopied] = useState(false)

  const code = toMermaid(mindmapNodes, mindmapEdges)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col gap-4 p-6 max-h-[80vh]">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-gray-800">Mermaid 내보내기</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              코드를 복사해{' '}
              <a
                href={getMermaidLiveUrl()}
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 underline"
              >
                mermaid.live
              </a>
              에 붙여넣으세요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* 코드 영역 */}
        <div className="relative flex-1 overflow-hidden">
          <pre className="bg-gray-950 text-green-400 rounded-xl p-4 text-xs overflow-auto h-full max-h-96 font-mono leading-relaxed">
            {code}
          </pre>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            {copied ? '✓ 복사됨' : '코드 복사'}
          </button>
          <a
            href={getMermaidLiveUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl py-2.5 text-sm text-center transition-colors"
          >
            mermaid.live 열기 →
          </a>
        </div>
      </div>
    </div>
  )
}
