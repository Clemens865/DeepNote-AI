import { useState, useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { X } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface CitationGraphViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

interface SourceNode {
  id: string
  label: string
  type?: string
  topics?: string[]
}

interface SourceEdge {
  source: string
  target: string
  label?: string
  weight?: number
}

const NODE_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

function CitationGraphContent({
  data,
  height,
  layout,
  weightThreshold,
  showEdgeLabels,
  showTopicBadges,
  showMinimap,
  onNodeSelect,
}: {
  data: Record<string, unknown>
  height: string
  layout: 'grid' | 'circular'
  weightThreshold: number
  showEdgeLabels: boolean
  showTopicBadges: boolean
  showMinimap: boolean
  onNodeSelect: (node: SourceNode | null) => void
}) {
  const sourceNodes = (data.nodes as SourceNode[]) || []
  const sourceEdges = (data.edges as SourceEdge[]) || []

  const nodes: Node[] = useMemo(() => {
    if (layout === 'circular') {
      const count = sourceNodes.length
      const radius = Math.max(150, count * 40)
      const cx = radius + 100
      const cy = radius + 100
      return sourceNodes.map((node, i) => {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2
        return {
          id: node.id,
          position: {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
          },
          data: {
            label: (
              <div className="text-center">
                <div className="text-xs font-bold text-white leading-tight">{node.label}</div>
                {showTopicBadges && node.topics && node.topics.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                    {node.topics.slice(0, 3).map((t, ti) => (
                      <span key={ti} className="text-[8px] bg-white/20 rounded px-1 py-0.5 text-white/80">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          style: {
            background: NODE_COLORS[i % NODE_COLORS.length],
            border: 'none',
            borderRadius: '12px',
            padding: '12px 16px',
            minWidth: '140px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
        }
      })
    }

    // Grid layout (default)
    const cols = Math.ceil(Math.sqrt(sourceNodes.length))
    return sourceNodes.map((node, i) => ({
      id: node.id,
      position: {
        x: (i % cols) * 250 + 50,
        y: Math.floor(i / cols) * 180 + 50,
      },
      data: {
        label: (
          <div className="text-center">
            <div className="text-xs font-bold text-white leading-tight">{node.label}</div>
            {showTopicBadges && node.topics && node.topics.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                {node.topics.slice(0, 3).map((t, ti) => (
                  <span key={ti} className="text-[8px] bg-white/20 rounded px-1 py-0.5 text-white/80">{t}</span>
                ))}
              </div>
            )}
          </div>
        ),
      },
      style: {
        background: NODE_COLORS[i % NODE_COLORS.length],
        border: 'none',
        borderRadius: '12px',
        padding: '12px 16px',
        minWidth: '140px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
    }))
  }, [sourceNodes, layout, showTopicBadges])

  const filteredEdges = useMemo(
    () => sourceEdges.filter((e) => (e.weight || 0) >= weightThreshold),
    [sourceEdges, weightThreshold]
  )

  const edges: Edge[] = useMemo(() =>
    filteredEdges.map((edge, i) => ({
      id: `e-${i}`,
      source: edge.source,
      target: edge.target,
      label: showEdgeLabels ? (edge.label || undefined) : undefined,
      animated: (edge.weight || 0) > 0.7,
      style: {
        stroke: '#94a3b8',
        strokeWidth: Math.max(1, (edge.weight || 0.5) * 3),
      },
      labelStyle: { fontSize: 10, fill: '#64748b' },
    })),
    [filteredEdges, showEdgeLabels]
  )

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const sn = sourceNodes.find((n) => n.id === node.id) || null
    onNodeSelect(sn)
  }, [sourceNodes, onNodeSelect])

  if (sourceNodes.length === 0) {
    return <div className="text-center text-sm text-zinc-400 py-8">No graph data available</div>
  }

  return (
    <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden" style={{ height }}>
      <ReactFlow
        key={layout}
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls />
        {showMinimap && (
          <MiniMap
            nodeColor={(node) => (node.style?.background as string) || '#6366f1'}
            maskColor="rgba(0,0,0,0.1)"
          />
        )}
      </ReactFlow>
    </div>
  )
}

function ControlsToolbar({
  layout,
  setLayout,
  weightThreshold,
  setWeightThreshold,
  showEdgeLabels,
  setShowEdgeLabels,
  showTopicBadges,
  setShowTopicBadges,
  showMinimap,
  setShowMinimap,
}: {
  layout: 'grid' | 'circular'
  setLayout: (v: 'grid' | 'circular') => void
  weightThreshold: number
  setWeightThreshold: (v: number) => void
  showEdgeLabels: boolean
  setShowEdgeLabels: (v: boolean) => void
  showTopicBadges: boolean
  setShowTopicBadges: (v: boolean) => void
  showMinimap: boolean
  setShowMinimap: (v: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-3 px-1">
      {/* Layout toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Layout:</span>
        <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
          {(['grid', 'circular'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                layout === l
                  ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
              }`}
            >
              {l === 'grid' ? 'Grid' : 'Circular'}
            </button>
          ))}
        </div>
      </div>

      {/* Weight threshold */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Min Weight:</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={weightThreshold}
          onChange={(e) => setWeightThreshold(parseFloat(e.target.value))}
          className="w-20 h-1 accent-indigo-500"
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400 w-6 text-right">{weightThreshold.toFixed(1)}</span>
      </div>

      {/* Toggles */}
      <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
        <input type="checkbox" checked={showEdgeLabels} onChange={(e) => setShowEdgeLabels(e.target.checked)} className="accent-indigo-500" />
        Labels
      </label>
      <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
        <input type="checkbox" checked={showTopicBadges} onChange={(e) => setShowTopicBadges(e.target.checked)} className="accent-indigo-500" />
        Topics
      </label>
      <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
        <input type="checkbox" checked={showMinimap} onChange={(e) => setShowMinimap(e.target.checked)} className="accent-indigo-500" />
        Minimap
      </label>
    </div>
  )
}

function NodeDetailPanel({
  node,
  sourceEdges,
  sourceNodes,
  weightThreshold,
  onClose,
}: {
  node: SourceNode
  sourceEdges: SourceEdge[]
  sourceNodes: SourceNode[]
  weightThreshold: number
  onClose: () => void
}) {
  const connectedNodes = useMemo(() => {
    const connected: { node: SourceNode; label: string; weight: number }[] = []
    for (const edge of sourceEdges) {
      if ((edge.weight || 0) < weightThreshold) continue
      let targetId: string | null = null
      if (edge.source === node.id) targetId = edge.target
      else if (edge.target === node.id) targetId = edge.source
      if (targetId) {
        const targetNode = sourceNodes.find((n) => n.id === targetId)
        if (targetNode) {
          connected.push({ node: targetNode, label: edge.label || 'related', weight: edge.weight || 0 })
        }
      }
    }
    return connected.sort((a, b) => b.weight - a.weight)
  }, [node, sourceEdges, sourceNodes, weightThreshold])

  return (
    <div className="mt-3 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{node.label}</h4>
          {node.type && <span className="text-xs text-zinc-500 dark:text-zinc-400">{node.type}</span>}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {node.topics && node.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {node.topics.map((t, i) => (
            <span key={i} className="text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full px-2 py-0.5">{t}</span>
          ))}
        </div>
      )}

      {connectedNodes.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">Connected Sources</h5>
          <div className="space-y-1">
            {connectedNodes.map((cn, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-zinc-700 dark:text-zinc-300">{cn.node.label}</span>
                <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">{cn.label} ({cn.weight.toFixed(1)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {connectedNodes.length === 0 && (
        <p className="text-xs text-zinc-400">No connections above current weight threshold.</p>
      )}
    </div>
  )
}

export function CitationGraphView({ data, isFullscreen, onCloseFullscreen, title }: CitationGraphViewProps) {
  const summary = data.summary as string | undefined
  const sourceNodes = (data.nodes as SourceNode[]) || []
  const sourceEdges = (data.edges as SourceEdge[]) || []

  const [layout, setLayout] = useState<'grid' | 'circular'>('grid')
  const [weightThreshold, setWeightThreshold] = useState(0)
  const [showEdgeLabels, setShowEdgeLabels] = useState(true)
  const [showTopicBadges, setShowTopicBadges] = useState(true)
  const [showMinimap, setShowMinimap] = useState(true)
  const [selectedNode, setSelectedNode] = useState<SourceNode | null>(null)

  return (
    <>
      {summary && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">{summary}</p>
      )}
      <ControlsToolbar
        layout={layout}
        setLayout={setLayout}
        weightThreshold={weightThreshold}
        setWeightThreshold={setWeightThreshold}
        showEdgeLabels={showEdgeLabels}
        setShowEdgeLabels={setShowEdgeLabels}
        showTopicBadges={showTopicBadges}
        setShowTopicBadges={setShowTopicBadges}
        showMinimap={showMinimap}
        setShowMinimap={setShowMinimap}
      />
      <CitationGraphContent
        data={data}
        height="500px"
        layout={layout}
        weightThreshold={weightThreshold}
        showEdgeLabels={showEdgeLabels}
        showTopicBadges={showTopicBadges}
        showMinimap={showMinimap}
        onNodeSelect={setSelectedNode}
      />
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          sourceEdges={sourceEdges}
          sourceNodes={sourceNodes}
          weightThreshold={weightThreshold}
          onClose={() => setSelectedNode(null)}
        />
      )}
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title} wide>
        <ControlsToolbar
          layout={layout}
          setLayout={setLayout}
          weightThreshold={weightThreshold}
          setWeightThreshold={setWeightThreshold}
          showEdgeLabels={showEdgeLabels}
          setShowEdgeLabels={setShowEdgeLabels}
          showTopicBadges={showTopicBadges}
          setShowTopicBadges={setShowTopicBadges}
          showMinimap={showMinimap}
          setShowMinimap={setShowMinimap}
        />
        <CitationGraphContent
          data={data}
          height="calc(100vh - 180px)"
          layout={layout}
          weightThreshold={weightThreshold}
          showEdgeLabels={showEdgeLabels}
          showTopicBadges={showTopicBadges}
          showMinimap={showMinimap}
          onNodeSelect={setSelectedNode}
        />
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            sourceEdges={sourceEdges}
            sourceNodes={sourceNodes}
            weightThreshold={weightThreshold}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </FullscreenWrapper>
    </>
  )
}
