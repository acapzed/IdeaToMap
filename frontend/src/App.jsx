import { useState, useEffect } from 'react'
import IdeaInput from './components/IdeaInput.jsx'
import IdeaConfirm from './components/IdeaConfirm.jsx'
import QAFlow from './components/QAFlow.jsx'
import MindmapView from './components/MindmapView.jsx'
import ReportView from './components/ReportView.jsx'
import { useSessionStore } from './store/session.js'

export default function App() {
  const phase = useSessionStore((s) => s.phase)
  const [rightTab, setRightTab] = useState('mindmap') // 'mindmap' | 'report'

  useEffect(() => {
    if (phase === 'DONE') setRightTab('report')
  }, [phase])

  return (
    <div className="flex h-full bg-white">
      {/* 왼쪽 패널 */}
      <div className="w-96 flex-shrink-0 border-r border-gray-100 flex flex-col shadow-sm">
        {phase === 'IDLE' && <IdeaInput />}
        {phase === 'CONFIRMING' && <IdeaConfirm />}
        {(phase === 'LOADING_QUESTIONS' || phase === 'ANSWERING' || phase === 'ENRICHING' || phase === 'DONE') && (
          <QAFlow />
        )}
      </div>

      {/* 오른쪽 패널 */}
      <div className="flex-1 flex flex-col">
        {/* 탭 — DONE일 때만 표시 */}
        {phase === 'DONE' && (
          <div className="flex border-b border-gray-100 bg-white px-4 flex-shrink-0">
            <TabButton active={rightTab === 'report'} onClick={() => setRightTab('report')}>리포트</TabButton>
            <TabButton active={rightTab === 'mindmap'} onClick={() => setRightTab('mindmap')}>마인드맵</TabButton>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {rightTab === 'report' && phase === 'DONE' ? <ReportView /> : <MindmapView />}
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  )
}
