import { useMemo, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider,
  Background, Controls, MiniMap,
  MarkerType,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { useSessionStore } from '../store/session.js'
import MermaidExport from './MermaidExport.jsx'

const NODE_WIDTH = 180
const NODE_HEIGHT = 52

const CATEGORY_COLORS = {
  root:           { bg: '#3b82f6', text: '#fff' },
  purpose:        { bg: '#8b5cf6', text: '#fff' },
  team_personas:  { bg: '#06b6d4', text: '#fff' },
  team_strengths: { bg: '#0891b2', text: '#fff' },
  problem_users:  { bg: '#f59e0b', text: '#fff' },
  features:       { bg: '#10b981', text: '#fff' },
  constraints:    { bg: '#ef4444', text: '#fff' },
  external_deps:  { bg: '#f97316', text: '#fff' },
  deliverables:   { bg: '#ec4899', text: '#fff' },
  market:         { bg: '#6366f1', text: '#fff' },
  business_model: { bg: '#84cc16', text: '#1a2e05' },
  risks:          { bg: '#dc2626', text: '#fff' },
  success:        { bg: '#059669', text: '#fff' },
}

const applyDagreLayout = (nodes, edges) => {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 60, nodesep: 20 })

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } }
  })
}

export default function MindmapView() {
  const { mindmapNodes, mindmapEdges, enrichment } = useSessionStore()
  const [showExport, setShowExport] = useState(false)

  const warningIds = useMemo(() => {
    if (!enrichment?.warnings) return new Set()
    return new Set(enrichment.warnings.map((w) => w.node_id))
  }, [enrichment])

  const rawRfNodes = useMemo(() =>
    mindmapNodes.map((n) => {
      const colors = CATEGORY_COLORS[n.category] ?? { bg: '#64748b', text: '#fff' }
      const isWarning = warningIds.has(n.id)
      const isGreyed = n.status === 'greyed'
      return {
        id: n.id,
        data: { label: n.label },
        position: { x: 0, y: 0 },
        style: {
          background: colors.bg,
          color: colors.text,
          borderRadius: 10,
          fontSize: n.category === 'root' ? 13 : 11,
          fontWeight: n.category === 'root' ? 700 : 400,
          padding: '6px 10px',
          width: NODE_WIDTH,
          minHeight: NODE_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          lineHeight: 1.4,
          opacity: isGreyed ? 0.3 : 1,
          boxShadow: isWarning
            ? `0 0 0 2px #f59e0b, 0 4px 12px rgba(0,0,0,0.15)`
            : '0 2px 8px rgba(0,0,0,0.12)',
          border: isWarning ? '2px solid #f59e0b' : 'none',
          transition: 'all 0.3s ease',
        },
      }
    }),
    [mindmapNodes, warningIds]
  )

  const rfEdges = useMemo(() =>
    mindmapEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#cbd5e1' },
      style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
    })),
    [mindmapEdges]
  )

  const rfNodes = useMemo(() => {
    if (rawRfNodes.length === 0 || rfEdges.length === 0) return rawRfNodes
    return applyDagreLayout(rawRfNodes, rfEdges)
  }, [rawRfNodes, rfEdges])

  if (rfNodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-300">
        <div className="text-5xl opacity-30">🗺</div>
        <p className="text-sm">아이디어를 입력하면 마인드맵이 여기에 나타납니다</p>
      </div>
    )
  }

  return (
    <div className="h-full relative">
      {showExport && <MermaidExport onClose={() => setShowExport(false)} />}

      {/* export 버튼 */}
      {mindmapNodes.length > 0 && (
        <button
          onClick={() => setShowExport(true)}
          className="absolute top-4 left-4 z-10 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl px-3 py-1.5 text-xs shadow-sm transition-colors"
        >
          Mermaid 내보내기
        </button>
      )}

      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          attributionPosition="bottom-right"
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => n.style?.background ?? '#64748b'}
            maskColor="rgba(255,255,255,0.7)"
          />
        </ReactFlow>
      </ReactFlowProvider>

      {/* 보강 패널 */}
      {enrichment?.suggestions?.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white shadow-xl rounded-2xl p-4 max-w-xs text-xs space-y-2 border border-gray-100">
          <p className="font-semibold text-gray-700">💬 AI 제안</p>
          {enrichment.suggestions.map((s, i) => (
            <p key={i} className="text-gray-600 leading-relaxed">• {s}</p>
          ))}
        </div>
      )}

      {enrichment?.warnings?.length > 0 && (
        <div className="absolute top-4 right-4 bg-amber-50 shadow-xl rounded-2xl p-4 max-w-xs text-xs space-y-2 border border-amber-100">
          <p className="font-semibold text-amber-700">⚠️ 주의</p>
          {enrichment.warnings.map((w, i) => (
            <p key={i} className="text-amber-600 leading-relaxed">• {w.message}</p>
          ))}
        </div>
      )}
    </div>
  )
}
