import IdeaInput from './components/IdeaInput.jsx'
import QAFlow from './components/QAFlow.jsx'
import MindmapView from './components/MindmapView.jsx'
import { useSessionStore } from './store/session.js'

export default function App() {
  const phase = useSessionStore((s) => s.phase)

  return (
    <div className="flex h-full">
      {/* Left panel: Q&A flow */}
      <div className="w-96 flex-shrink-0 border-r border-gray-200 flex flex-col">
        {phase === 'IDLE' && <IdeaInput />}
        {(phase === 'LOADING_QUESTIONS' || phase === 'ANSWERING') && <QAFlow />}
        {phase === 'DONE' && (
          <div className="p-6 text-green-700 font-medium">
            Complete — see your mindmap →
          </div>
        )}
      </div>

      {/* Right panel: live mindmap */}
      <div className="flex-1">
        <MindmapView />
      </div>
    </div>
  )
}
