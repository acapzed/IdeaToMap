import { useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import { useSessionStore } from '../store/session.js'

// Map category → color
const CATEGORY_COLORS = {
  root:           '#3b82f6',
  purpose:        '#8b5cf6',
  team_personas:  '#06b6d4',
  team_strengths: '#06b6d4',
  problem_users:  '#f59e0b',
  features:       '#10b981',
  constraints:    '#ef4444',
  external_deps:  '#f97316',
  deliverables:   '#ec4899',
  market:         '#6366f1',
  business_model: '#84cc16',
  risks:          '#dc2626',
  success:        '#059669',
}

const STATUS_STYLES = {
  active:    { opacity: 1 },
  greyed:    { opacity: 0.3 },
  warning:   { opacity: 1, border: '2px solid #f59e0b' },
  confirmed: { opacity: 1, border: '2px solid #10b981' },
}

export default function MindmapView() {
  const { mindmapNodes, mindmapEdges, enrichment } = useSessionStore()

  // Map warning node IDs for quick lookup
  const warningIds = useMemo(() => {
    if (!enrichment?.warnings) return new Set()
    return new Set(enrichment.warnings.map((w) => w.node_id))
  }, [enrichment])

  const rfNodes = useMemo(() =>
    mindmapNodes.map((n, i) => ({
      id: n.id,
      data: { label: n.label },
      position: {
        // Simple radial layout placeholder — replace with proper layout later
        x: n.category === 'root' ? 400 : 100 + (i % 4) * 220,
        y: n.category === 'root' ? 300 :  80 + Math.floor(i / 4) * 100,
      },
      style: {
        background: CATEGORY_COLORS[n.category] ?? '#64748b',
        color: '#fff',
        borderRadius: 8,
        fontSize: 12,
        padding: '6px 12px',
        ...(warningIds.has(n.id) ? STATUS_STYLES.warning : STATUS_STYLES[n.status] ?? {}),
      },
    })),
    [mindmapNodes, warningIds]
  )

  const rfEdges = useMemo(() =>
    mindmapEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      style: { stroke: '#94a3b8' },
    })),
    [mindmapEdges]
  )

  if (rfNodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-300 text-sm">
        아이디어를 입력하면 마인드맵이 여기에 나타납니다
      </div>
    )
  }

  return (
    <div className="h-full relative">
      <ReactFlow nodes={rfNodes} edges={rfEdges} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Enrichment panel */}
      {enrichment?.suggestions?.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 max-w-xs text-xs space-y-1">
          <p className="font-semibold text-gray-700 mb-2">AI 제안</p>
          {enrichment.suggestions.map((s, i) => (
            <p key={i} className="text-gray-600">• {s}</p>
          ))}
        </div>
      )}
    </div>
  )
}
