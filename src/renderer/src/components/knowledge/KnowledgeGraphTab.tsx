import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Search, Loader2, RotateCcw } from 'lucide-react'

interface GraphNode {
  id: string
  label: string
  type: string
  importance: number
  content?: string
}

interface GraphEdge {
  source: string
  target: string
  weight: number
}

const TYPE_COLORS: Record<string, string> = {
  document: '#6366f1',
  note: '#8b5cf6',
  manual: '#a855f7',
  clipboard: '#f59e0b',
  chat: '#3b82f6',
}

export function KnowledgeGraphTab() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadGraph = useCallback(async (seedId?: string) => {
    setLoading(true)
    try {
      const result = await window.api.knowledgeGraph({ seedId, hops: 2 })

      // Position nodes in a force-directed-like layout (simple circular)
      const angle = (2 * Math.PI) / Math.max(result.nodes.length, 1)
      const radius = Math.max(200, result.nodes.length * 30)

      const flowNodes: Node[] = result.nodes.map((n: GraphNode, i: number) => ({
        id: n.id,
        position: {
          x: Math.cos(angle * i) * radius + 400,
          y: Math.sin(angle * i) * radius + 300,
        },
        data: {
          ...n,
          label: n.label.slice(0, 40),
        },
        style: {
          background: TYPE_COLORS[n.type] || '#71717a',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          padding: '8px 12px',
          fontSize: '11px',
          fontWeight: 500,
          minWidth: '80px',
          textAlign: 'center' as const,
          boxShadow: `0 2px 8px ${TYPE_COLORS[n.type] || '#71717a'}40`,
        },
      }))

      const flowEdges: Edge[] = result.edges.map((e: GraphEdge, i: number) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        animated: e.weight > 0.8,
        style: {
          stroke: '#a78bfa',
          strokeWidth: Math.max(1, e.weight * 3),
          opacity: 0.4 + e.weight * 0.6,
        },
      }))

      setNodes(flowNodes)
      setEdges(flowEdges)
    } catch (err) {
      console.error('Failed to load graph:', err)
    }
    setLoading(false)
  }, [setNodes, setEdges])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const data = node.data as unknown as GraphNode
    setSelectedNode(data)
    // Expand graph from this node
    loadGraph(data.id)
  }, [loadGraph])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const results = await window.api.knowledgeSearch({ query: searchQuery, limit: 1 })
      if (results.length > 0) {
        loadGraph(results[0].id)
      }
    } catch {
      // ignore
    }
  }

  const legend = useMemo(() => Object.entries(TYPE_COLORS), [])

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 dark:bg-zinc-950/50">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-slate-50 dark:bg-zinc-950"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
          <Controls className="[&_button]:!bg-white [&_button]:dark:!bg-zinc-800 [&_button]:!border-black/10 [&_button]:dark:!border-white/10" />

          <Panel position="top-left" className="!m-3">
            <div className="flex gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg p-2 border border-black/[0.06] dark:border-white/[0.06]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Find memory..."
                  className="pl-7 pr-3 py-1 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-transparent text-zinc-900 dark:text-zinc-100 w-48 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
              <button
                onClick={() => loadGraph()}
                className="p-1 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-zinc-500"
                title="Reset view"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </Panel>

          <Panel position="bottom-left" className="!m-3">
            <div className="flex flex-wrap gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg p-2 border border-black/[0.06] dark:border-white/[0.06]">
              {legend.map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-zinc-500 capitalize">{type}</span>
                </div>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="w-72 shrink-0 border-l border-black/[0.06] dark:border-white/[0.06] p-4 overflow-auto bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="px-2 py-0.5 text-[10px] rounded-full font-medium text-white capitalize"
              style={{ backgroundColor: TYPE_COLORS[selectedNode.type] || '#71717a' }}
            >
              {selectedNode.type}
            </span>
          </div>

          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">{selectedNode.label}</h3>

          {selectedNode.importance > 0 && (
            <div className="mb-3">
              <div className="text-[10px] text-zinc-500 mb-1">Importance</div>
              <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${selectedNode.importance * 100}%` }}
                />
              </div>
            </div>
          )}

          {selectedNode.content && (
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Content</div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{selectedNode.content}</p>
            </div>
          )}

          <p className="text-[10px] text-zinc-400 mt-3 font-mono">{selectedNode.id.slice(0, 8)}...</p>
        </div>
      )}
    </div>
  )
}
