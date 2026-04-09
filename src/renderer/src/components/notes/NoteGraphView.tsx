import { useEffect, useRef, useState, useCallback } from 'react'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'
import { GitBranch, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import type { Note } from '@shared/types'

interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
  tags: string[]
  linkCount: number
}

interface GraphEdge {
  source: string
  target: string
}

const LINK_REGEX = /\[\[([^\]]+)\]\]/g

function extractLinks(content: string): string[] {
  const links: string[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(LINK_REGEX)
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1])
  }
  return links
}

function buildGraph(notes: Note[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const titleToId = new Map<string, string>()
  for (const note of notes) {
    titleToId.set(note.title.toLowerCase(), note.id)
  }

  const edges: GraphEdge[] = []
  const linkCounts = new Map<string, number>()

  for (const note of notes) {
    const links = extractLinks(note.content)
    for (const linkTitle of links) {
      const targetId = titleToId.get(linkTitle.toLowerCase())
      if (targetId && targetId !== note.id) {
        edges.push({ source: note.id, target: targetId })
        linkCounts.set(note.id, (linkCounts.get(note.id) || 0) + 1)
        linkCounts.set(targetId, (linkCounts.get(targetId) || 0) + 1)
      }
    }
  }

  const nodes: GraphNode[] = notes.map((note, i) => {
    const angle = (2 * Math.PI * i) / notes.length
    const radius = 200 + Math.random() * 100
    return {
      id: note.id,
      label: note.title || 'Untitled',
      x: 400 + radius * Math.cos(angle),
      y: 300 + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
      tags: Array.isArray(note.tags) ? note.tags : [],
      linkCount: linkCounts.get(note.id) || 0,
    }
  })

  return { nodes, edges }
}

// Simple force-directed layout
function simulateForces(nodes: GraphNode[], edges: GraphEdge[], centerX: number, centerY: number) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = 800 / (dist * dist)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      a.vx -= fx
      a.vy -= fy
      b.vx += fx
      b.vy += fy
    }
  }

  // Attraction along edges
  for (const edge of edges) {
    const a = nodeMap.get(edge.source)
    const b = nodeMap.get(edge.target)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const force = (dist - 120) * 0.01
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    a.vx += fx
    a.vy += fy
    b.vx -= fx
    b.vy -= fy
  }

  // Center gravity
  for (const node of nodes) {
    node.vx += (centerX - node.x) * 0.001
    node.vy += (centerY - node.y) * 0.001
  }

  // Apply velocity with damping
  for (const node of nodes) {
    node.vx *= 0.9
    node.vy *= 0.9
    node.x += node.vx
    node.y += node.vy
  }
}

// Tag to color mapping
const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#2563eb',
]

function getNodeColor(node: GraphNode): string {
  if (node.tags.length === 0) return '#71717a'
  const hash = node.tags[0].split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return TAG_COLORS[hash % TAG_COLORS.length]
}

export function NoteGraphView() {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const graphRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] })
  const animRef = useRef<number>(0)
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({ node: null, offsetX: 0, offsetY: 0 })
  const isDarkRef = useRef(document.documentElement.classList.contains('dark'))

  useEffect(() => {
    if (!currentNotebook) return
    window.api.listNotes(currentNotebook.id).then((result: Note[]) => {
      setNotes(result)
    })
  }, [currentNotebook])

  useEffect(() => {
    if (notes.length === 0) return
    const graph = buildGraph(notes)
    graphRef.current = graph

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()

    let iteration = 0
    const maxIterations = 300

    const draw = () => {
      const { nodes, edges } = graphRef.current
      const w = canvas.width / window.devicePixelRatio
      const h = canvas.height / window.devicePixelRatio

      // Only simulate if not settled
      if (iteration < maxIterations) {
        simulateForces(nodes, edges, w / 2, h / 2)
        iteration++
      }

      isDarkRef.current = document.documentElement.classList.contains('dark')
      const dark = isDarkRef.current

      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, w, h)

      ctx.save()
      ctx.translate(panRef.current.x, panRef.current.y)
      ctx.scale(zoomRef.current, zoomRef.current)

      // Draw edges
      for (const edge of edges) {
        const source = nodes.find((n) => n.id === edge.source)
        const target = nodes.find((n) => n.id === edge.target)
        if (!source || !target) continue
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        const radius = 4 + Math.min(node.linkCount * 2, 12)
        const color = getNodeColor(node)
        const isHovered = hoveredNode?.id === node.id

        ctx.beginPath()
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = isHovered ? color : `${color}cc`
        ctx.fill()

        if (isHovered) {
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.stroke()
        }

        // Label
        ctx.fillStyle = dark ? '#e4e4e7' : '#27272a'
        ctx.font = `${isHovered ? '12px' : '10px'} Inter, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(node.label, node.x, node.y + radius + 14)
      }

      ctx.restore()

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    const resizeObserver = new ResizeObserver(resize)
    if (containerRef.current) resizeObserver.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(animRef.current)
      resizeObserver.disconnect()
    }
  }, [notes, hoveredNode])

  const screenToGraph = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const x = (clientX - rect.left - panRef.current.x) / zoomRef.current
    const y = (clientY - rect.top - panRef.current.y) / zoomRef.current
    return { x, y }
  }, [])

  const findNodeAt = useCallback((clientX: number, clientY: number) => {
    const { x, y } = screenToGraph(clientX, clientY)
    const { nodes } = graphRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]
      const radius = 4 + Math.min(node.linkCount * 2, 12)
      const dx = node.x - x
      const dy = node.y - y
      if (dx * dx + dy * dy < (radius + 4) * (radius + 4)) {
        return node
      }
    }
    return null
  }, [screenToGraph])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current.node) {
      const { x, y } = screenToGraph(e.clientX, e.clientY)
      dragRef.current.node.x = x
      dragRef.current.node.y = y
      dragRef.current.node.vx = 0
      dragRef.current.node.vy = 0
      return
    }
    const node = findNodeAt(e.clientX, e.clientY)
    setHoveredNode(node)
  }, [findNodeAt, screenToGraph])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const node = findNodeAt(e.clientX, e.clientY)
    if (node) {
      dragRef.current = { node, offsetX: 0, offsetY: 0 }
    }
  }, [findNodeAt])

  const handleMouseUp = useCallback(() => {
    dragRef.current = { node: null, offsetX: 0, offsetY: 0 }
  }, [])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const node = findNodeAt(e.clientX, e.clientY)
    if (node) {
      // Navigate to the note
      setActiveView('notes')
    }
  }, [findNodeAt, setActiveView])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.95 : 1.05
    const newZoom = Math.max(0.1, Math.min(5, zoomRef.current * factor))
    zoomRef.current = newZoom
  }, [])

  const handleZoom = (direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 1.2 : 0.8
    zoomRef.current = Math.max(0.1, Math.min(5, zoomRef.current * factor))
  }

  const handleReset = () => {
    zoomRef.current = 1
    panRef.current = { x: 0, y: 0 }
  }

  return (
    <div className="h-full flex flex-col bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Graph</h2>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {graphRef.current.nodes.length} notes, {graphRef.current.edges.length} links
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleZoom('in')}
            className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-zinc-500 dark:text-zinc-400 transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-zinc-500 dark:text-zinc-400 transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-zinc-500 dark:text-zinc-400 transition-colors"
            title="Reset view"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {notes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <GitBranch className="w-10 h-10 text-zinc-400 dark:text-zinc-500 mb-4" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              No notes to visualize
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Create notes with [[wiki links]] to see the knowledge graph.
            </p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            className="w-full h-full cursor-crosshair"
          />
        )}

        {/* Hovered node tooltip */}
        {hoveredNode && (
          <div className="absolute bottom-4 left-4 px-3 py-2 rounded-lg bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.06] shadow-lg">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{hoveredNode.label}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {hoveredNode.linkCount} connections
              {hoveredNode.tags.length > 0 && ` · ${hoveredNode.tags.join(', ')}`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
