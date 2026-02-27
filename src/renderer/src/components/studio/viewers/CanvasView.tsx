import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, Type, StickyNote, FileText, Trash2 } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface CanvasViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
  contentId?: string
}

// Use [key: string]: unknown to satisfy Record<string, unknown> constraint
interface CanvasNodeData extends Record<string, unknown> {
  label: string
  content?: string
  nodeType: 'note' | 'source' | 'text'
  color?: string
}

// Custom node component for canvas cards
function CanvasCard({ data }: { data: CanvasNodeData }) {
  const colorMap: Record<string, string> = {
    note: 'border-amber-400 bg-amber-50 dark:bg-amber-500/10',
    source: 'border-blue-400 bg-blue-50 dark:bg-blue-500/10',
    text: 'border-zinc-300 bg-white dark:bg-zinc-800',
  }
  const borderClass = colorMap[data.nodeType] || colorMap.text

  return (
    <div className={`rounded-xl border-2 ${borderClass} p-3 min-w-[160px] max-w-[260px] shadow-sm`}>
      <div className="flex items-center gap-1.5 mb-1">
        {data.nodeType === 'note' && <StickyNote size={12} className="text-amber-500 flex-shrink-0" />}
        {data.nodeType === 'source' && <FileText size={12} className="text-blue-500 flex-shrink-0" />}
        {data.nodeType === 'text' && <Type size={12} className="text-zinc-400 flex-shrink-0" />}
        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{data.label}</span>
      </div>
      {data.content && (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-4 whitespace-pre-wrap">
          {data.content}
        </p>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  canvasCard: CanvasCard,
}

function CanvasContent({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  height,
}: {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  height: string
}) {
  return (
    <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        attributionPosition="bottom-left"
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={() => '#6366f1'}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  )
}

export function CanvasView({ data, isFullscreen, onCloseFullscreen, title, contentId }: CanvasViewProps) {
  const canvasData = data as { nodes?: { id: string; type: string; label: string; content?: string; position: { x: number; y: number } }[]; edges?: { id: string; source: string; target: string; label?: string }[] }
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeCountRef = useRef(0)

  const initialNodes = useMemo<Node[]>(() => {
    const raw = canvasData.nodes || []
    nodeCountRef.current = raw.length
    return raw.map((n): Node => ({
      id: n.id,
      type: 'canvasCard',
      position: n.position,
      data: { label: n.label, content: n.content, nodeType: (n.type as 'note' | 'source' | 'text') || 'text' } satisfies CanvasNodeData,
    }))
  }, [])

  const initialEdges = useMemo<Edge[]>(() => {
    const raw = canvasData.edges || []
    return raw.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: '#64748b' },
    }))
  }, [])

  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)

  const scheduleSave = useCallback(() => {
    if (!contentId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const saveData = {
        nodes: nodes.map((n) => {
          const d = n.data as CanvasNodeData
          return {
            id: n.id,
            type: d.nodeType,
            label: d.label,
            content: d.content,
            position: n.position,
          }
        }),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label as string | undefined,
        })),
      }
      window.api.canvasSave({ id: contentId, data: saveData }).catch(() => {})
    }, 500)
  }, [contentId, nodes, edges])

  // Save whenever nodes or edges change
  useEffect(() => {
    scheduleSave()
  }, [nodes, edges, scheduleSave])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `e-${Date.now()}`,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
          },
          eds
        )
      ),
    []
  )

  const addTextCard = () => {
    nodeCountRef.current++
    const id = `card-${Date.now()}`
    const newNode: Node = {
      id,
      type: 'canvasCard',
      position: { x: 100 + nodeCountRef.current * 30, y: 100 + nodeCountRef.current * 30 },
      data: { label: 'New Card', content: '', nodeType: 'text' } satisfies CanvasNodeData,
    }
    setNodes((prev) => [...prev, newNode])
  }

  const deleteSelected = () => {
    setNodes((nds) => nds.filter((n) => !n.selected))
    setEdges((eds) => {
      const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
      return eds.filter(
        (e) => !e.selected && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
      )
    })
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={addTextCard}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
        >
          <Plus size={14} />
          Add Card
        </button>
        <button
          onClick={deleteSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={14} />
          Delete Selected
        </button>
      </div>

      <CanvasContent
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        height="500px"
      />

      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title} wide>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={addTextCard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          >
            <Plus size={14} />
            Add Card
          </button>
          <button
            onClick={deleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
            Delete Selected
          </button>
        </div>
        <CanvasContent
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          height="calc(100vh - 180px)"
        />
      </FullscreenWrapper>
    </>
  )
}
