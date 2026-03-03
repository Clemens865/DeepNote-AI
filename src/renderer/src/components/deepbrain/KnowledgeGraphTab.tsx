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
import { Search, Loader2, X, Maximize2, RotateCcw } from 'lucide-react'

interface GraphNode {
  id: string
  label: string
  memoryType: string
  importance: number
  content?: string
}

interface GraphEdge {
  source: string
  target: string
  weight: number
  edgeType?: string
}

type FlowNodeData = { label: string; memoryType: string; importance: number; content?: string; nodeId: string }
type FlowNode = Node<FlowNodeData>
type FlowEdge = Edge

const MEMORY_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  semantic: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  episodic: { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  working: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  procedural: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  meta: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  causal: { bg: '#ffedd5', border: '#f97316', text: '#9a3412' },
  goal: { bg: '#cffafe', border: '#06b6d4', text: '#155e75' },
  emotional: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
}

function getColors(memoryType: string) {
  return MEMORY_TYPE_COLORS[memoryType] || { bg: '#f4f4f5', border: '#a1a1aa', text: '#3f3f46' }
}

function makeFlowNode(gn: GraphNode, x: number, y: number, isSeed = false): FlowNode {
  const c = getColors(gn.memoryType)
  return {
    id: gn.id,
    position: { x, y },
    data: {
      label: gn.label || gn.id.slice(0, 8),
      memoryType: gn.memoryType,
      importance: gn.importance,
      content: gn.content,
      nodeId: gn.id,
    },
    style: {
      background: c.bg,
      border: `2px solid ${c.border}`,
      borderRadius: '12px',
      padding: '8px 12px',
      fontSize: '11px',
      fontWeight: isSeed ? 600 : 500,
      color: c.text,
      maxWidth: '140px',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  }
}

function layoutNodes(graphNodes: GraphNode[], seedId?: string): FlowNode[] {
  if (graphNodes.length === 0) return []

  const centerX = 400
  const centerY = 300
  const seedIndex = seedId ? graphNodes.findIndex((n) => n.id === seedId) : 0
  const center = seedIndex >= 0 ? graphNodes[seedIndex] : graphNodes[0]
  const rest = graphNodes.filter((n) => n.id !== center.id)

  const result: FlowNode[] = [makeFlowNode(center, centerX - 60, centerY - 20, true)]

  const ringSize = 8
  rest.forEach((node, i) => {
    const ring = Math.floor(i / ringSize) + 1
    const angleIndex = i % ringSize
    const angleOffset = ring % 2 === 0 ? Math.PI / ringSize : 0
    const angle = (angleIndex / ringSize) * 2 * Math.PI + angleOffset
    const radius = ring * 160
    result.push(
      makeFlowNode(
        node,
        centerX - 60 + Math.cos(angle) * radius,
        centerY - 20 + Math.sin(angle) * radius,
      )
    )
  })

  return result
}

function layoutEdges(graphEdges: GraphEdge[]): FlowEdge[] {
  return graphEdges.map((e, i) => ({
    id: `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    animated: e.weight > 0.7,
    style: {
      stroke: '#a1a1aa',
      strokeWidth: Math.max(1, Math.min(3, e.weight * 3)),
      opacity: 0.5 + e.weight * 0.5,
    },
  }))
}

export function KnowledgeGraphTab() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const [graphStats, setGraphStats] = useState<{ nodeCount: number; edgeCount: number } | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanding, setExpanding] = useState(false)
  const [loadedNodeIds, setLoadedNodeIds] = useState<Set<string>>(new Set())

  const loadInitialGraph = useCallback(async () => {
    setLoading(true)
    try {
      // Get stats and a seed memory to start the graph
      const [stats, seedMemories] = await Promise.all([
        window.api.deepbrainGraphStats(),
        window.api.deepbrainMemories({ offset: 0, limit: 1 }),
      ])
      setGraphStats(stats)

      // Use the first memory as seed node
      const seedId = seedMemories?.items?.[0]?.id
      if (!seedId) {
        setLoading(false)
        return
      }

      const data = await window.api.deepbrainGraphNeighbors({ nodeId: seedId, hops: 2 })

      if (data && data.nodes.length > 0) {
        const firstId = data.nodes[0].id
        setNodes(layoutNodes(data.nodes, firstId))
        setEdges(layoutEdges(data.edges))
        setLoadedNodeIds(new Set(data.nodes.map((n: GraphNode) => n.id)))
      }
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    loadInitialGraph()
  }, [loadInitialGraph])

  const handleNodeClick: NodeMouseHandler<FlowNode> = useCallback(
    async (_event, node) => {
      const d = node.data
      setSelectedNode({
        id: d.nodeId,
        label: d.label,
        memoryType: d.memoryType,
        importance: d.importance,
        content: d.content,
      })

      if (loadedNodeIds.has(node.id)) return

      setExpanding(true)
      try {
        const data = await window.api.deepbrainGraphNeighbors({ nodeId: node.id, hops: 1 })
        if (data) {
          const newNodeIds = new Set(loadedNodeIds)
          const existingIds = new Set(nodes.map((n) => n.id))

          const newGraphNodes = data.nodes.filter((n: GraphNode) => !existingIds.has(n.id))
          if (newGraphNodes.length > 0) {
            const clickedPos = node.position
            const newFlowNodes = newGraphNodes.map((gn: GraphNode, i: number) => {
              const angle = (i / newGraphNodes.length) * 2 * Math.PI
              const radius = 120
              return makeFlowNode(
                gn,
                (clickedPos?.x || 0) + Math.cos(angle) * radius,
                (clickedPos?.y || 0) + Math.sin(angle) * radius,
              )
            })
            setNodes((prev) => [...prev, ...newFlowNodes])
          }

          const existingEdgeKeys = new Set(edges.map((e) => `${e.source}-${e.target}`))
          const newEdges = data.edges
            .filter((e: GraphEdge) => !existingEdgeKeys.has(`${e.source}-${e.target}`))
            .map((e: GraphEdge, i: number): FlowEdge => ({
              id: `e-${e.source}-${e.target}-exp-${i}`,
              source: e.source,
              target: e.target,
              animated: e.weight > 0.7,
              style: {
                stroke: '#a1a1aa',
                strokeWidth: Math.max(1, Math.min(3, e.weight * 3)),
                opacity: 0.5 + e.weight * 0.5,
              },
            }))

          if (newEdges.length > 0) {
            setEdges((prev) => [...prev, ...newEdges])
          }

          data.nodes.forEach((n: GraphNode) => newNodeIds.add(n.id))
          newNodeIds.add(node.id)
          setLoadedNodeIds(newNodeIds)
        }
      } catch {
        // ignore
      } finally {
        setExpanding(false)
      }
    },
    [nodes, edges, loadedNodeIds, setNodes, setEdges]
  )

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setLoading(true)
    try {
      const results = await window.api.deepbrainRecall({ query: searchQuery, limit: 1 })
      if (results && results.length > 0) {
        const targetId = results[0].id
        const data = await window.api.deepbrainGraphNeighbors({ nodeId: targetId, hops: 2 })
        if (data && data.nodes.length > 0) {
          setNodes(layoutNodes(data.nodes, targetId))
          setEdges(layoutEdges(data.edges))
          setLoadedNodeIds(new Set(data.nodes.map((n: GraphNode) => n.id)))
          const found = data.nodes.find((n: GraphNode) => n.id === targetId)
          setSelectedNode(found || null)
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const legend = useMemo(
    () =>
      Object.entries(MEMORY_TYPE_COLORS).map(([type, colors]) => ({
        type,
        color: colors.border,
      })),
    []
  )

  return (
    <div className="flex h-full">
      {/* Graph area */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-400">
            <p className="text-sm">No graph data available</p>
            <p className="text-xs">DeepBrain needs memories to build a knowledge graph</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d8" />
            <Controls showInteractive={false} />

            {/* Search bar */}
            <Panel position="top-left">
              <div className="flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg border border-black/[0.08] dark:border-white/[0.08] p-1.5 shadow-sm">
                <Search className="w-4 h-4 text-zinc-400 ml-1" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Find memory..."
                  className="text-xs bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 w-40"
                />
                <button
                  onClick={handleSearch}
                  className="px-2 py-1 rounded text-[10px] font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                >
                  Go
                </button>
                <button
                  onClick={loadInitialGraph}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Reset graph"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </Panel>

            {/* Stats + Legend */}
            <Panel position="top-right">
              <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg border border-black/[0.08] dark:border-white/[0.08] p-3 shadow-sm space-y-2">
                {graphStats && (
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 space-y-0.5">
                    <p>Nodes: {graphStats.nodeCount.toLocaleString()}</p>
                    <p>Edges: {graphStats.edgeCount.toLocaleString()}</p>
                    <p>Showing: {nodes.length}</p>
                  </div>
                )}
                <div className="space-y-1">
                  {legend.map(({ type, color }) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 capitalize">{type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            {expanding && (
              <Panel position="bottom-center">
                <div className="flex items-center gap-1.5 bg-violet-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Expanding...
                </div>
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="w-72 border-l border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-900 p-4 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Node Details</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-zinc-400 uppercase">ID</label>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 font-mono break-all">{selectedNode.id}</p>
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-400 uppercase">Type</label>
              <p className="text-xs capitalize">
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: getColors(selectedNode.memoryType).bg,
                    color: getColors(selectedNode.memoryType).text,
                  }}
                >
                  {selectedNode.memoryType}
                </span>
              </p>
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-400 uppercase">Label</label>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">{selectedNode.label}</p>
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-400 uppercase">Importance</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${selectedNode.importance * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500">{(selectedNode.importance * 100).toFixed(0)}%</span>
              </div>
            </div>
            {selectedNode.content && (
              <div>
                <label className="text-[10px] font-medium text-zinc-400 uppercase">Content</label>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedNode.content}
                </p>
              </div>
            )}
            <button
              className="flex items-center gap-1.5 w-full justify-center py-1.5 rounded-lg text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
              Center on node
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
