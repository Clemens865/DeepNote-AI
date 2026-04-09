import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  FolderPlus,
  FileText,
} from 'lucide-react'
import type { NoteFolder } from '@shared/types'

interface FolderTreeProps {
  folders: NoteFolder[]
  selectedFolderId: string | null // null = "All Notes"
  onSelectFolder: (folderId: string | null) => void
  onCreateFolder: (name: string, parentId: string | null) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onMoveNoteToFolder: (noteId: string, folderId: string | null) => void
}

interface TreeNode {
  folder: NoteFolder
  children: TreeNode[]
}

function buildTree(folders: NoteFolder[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const folder of folders) {
    map.set(folder.id, { folder, children: [] })
  }

  for (const folder of folders) {
    const node = map.get(folder.id)!
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by sortOrder then name
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.folder.sortOrder - b.folder.sortOrder || a.folder.name.localeCompare(b.folder.name))
    for (const node of nodes) {
      sortChildren(node.children)
    }
  }
  sortChildren(roots)

  return roots
}

export function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveNoteToFolder,
}: FolderTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [creatingIn, setCreatingIn] = useState<string | null | false>(false) // null = root, string = parentId, false = not creating
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const tree = buildTree(folders)

  useEffect(() => {
    if ((creatingIn !== false || renamingId) && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [creatingIn, renamingId])

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreateSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const name = e.currentTarget.value.trim()
      if (name) {
        const parentId = creatingIn === null ? null : (creatingIn as string)
        onCreateFolder(name, parentId)
        if (parentId) {
          setExpandedIds((prev) => new Set(prev).add(parentId))
        }
      }
      setCreatingIn(false)
    } else if (e.key === 'Escape') {
      setCreatingIn(false)
    }
  }

  const handleRenameSubmit = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      const name = e.currentTarget.value.trim()
      if (name) {
        onRenameFolder(id, name)
      }
      setRenamingId(null)
    } else if (e.key === 'Escape') {
      setRenamingId(null)
    }
  }

  // Drag-and-drop handlers for notes being dragged onto folders
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-note-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, folderId: string | null) => {
      e.preventDefault()
      const noteId = e.dataTransfer.getData('application/x-note-id')
      if (noteId) {
        onMoveNoteToFolder(noteId, folderId)
      }
    },
    [onMoveNoteToFolder]
  )

  const renderNode = (node: TreeNode, depth: number) => {
    const isExpanded = expandedIds.has(node.folder.id)
    const isSelected = selectedFolderId === node.folder.id
    const hasChildren = node.children.length > 0

    return (
      <div key={node.folder.id}>
        <div
          className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer group text-xs transition-colors rounded-md mx-1 ${
            isSelected
              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onSelectFolder(node.folder.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, folderId: node.folder.id })
          }}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, node.folder.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(node.folder.id)
              }}
              className="w-4 h-4 flex items-center justify-center flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4 h-4 flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
          ) : (
            <Folder className="w-3.5 h-3.5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
          )}
          {renamingId === node.folder.id ? (
            <input
              ref={inputRef}
              defaultValue={node.folder.name}
              className="flex-1 min-w-0 text-xs bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-indigo-600 rounded px-1 py-0.5 outline-none"
              onKeyDown={(e) => handleRenameSubmit(e, node.folder.id)}
              onBlur={() => setRenamingId(null)}
            />
          ) : (
            <span className="truncate flex-1 min-w-0">{node.folder.name}</span>
          )}
        </div>

        {isExpanded &&
          node.children.map((child) => renderNode(child, depth + 1))}

        {/* Inline create input when creating a subfolder under this folder */}
        {creatingIn === node.folder.id && isExpanded && (
          <div
            className="flex items-center gap-1 px-2 py-1 mx-1"
            style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
          >
            <span className="w-4 h-4 flex-shrink-0" />
            <Folder className="w-3.5 h-3.5 flex-shrink-0 text-amber-500/50" />
            <input
              ref={inputRef}
              placeholder="Folder name..."
              className="flex-1 min-w-0 text-xs bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-indigo-600 rounded px-1 py-0.5 outline-none"
              onKeyDown={handleCreateSubmit}
              onBlur={() => setCreatingIn(false)}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="py-1">
      {/* All Notes */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs transition-colors rounded-md mx-1 ${
          selectedFolderId === null
            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
        }`}
        onClick={() => onSelectFolder(null)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, null)}
      >
        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium">All Notes</span>
      </div>

      {/* Folder tree */}
      {tree.map((node) => renderNode(node, 0))}

      {/* Inline create at root */}
      {creatingIn === null && (
        <div className="flex items-center gap-1 px-3 py-1 mx-1">
          <Folder className="w-3.5 h-3.5 flex-shrink-0 text-amber-500/50" />
          <input
            ref={inputRef}
            placeholder="Folder name..."
            className="flex-1 min-w-0 text-xs bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-indigo-600 rounded px-1 py-0.5 outline-none"
            onKeyDown={handleCreateSubmit}
            onBlur={() => setCreatingIn(false)}
          />
        </div>
      )}

      {/* New folder button */}
      {creatingIn === false && (
        <button
          onClick={() => setCreatingIn(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 mx-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] w-[calc(100%-8px)]"
        >
          <Plus className="w-3 h-3" />
          <span>New folder</span>
        </button>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            onClick={() => {
              setRenamingId(contextMenu.folderId)
              setContextMenu(null)
            }}
          >
            <Pencil className="w-3 h-3" />
            Rename
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            onClick={() => {
              setCreatingIn(contextMenu.folderId)
              setExpandedIds((prev) => new Set(prev).add(contextMenu.folderId))
              setContextMenu(null)
            }}
          >
            <FolderPlus className="w-3 h-3" />
            New subfolder
          </button>
          <div className="border-t border-black/[0.06] dark:border-white/[0.06] my-1" />
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            onClick={() => {
              onDeleteFolder(contextMenu.folderId)
              setContextMenu(null)
              if (selectedFolderId === contextMenu.folderId) {
                onSelectFolder(null)
              }
            }}
          >
            <Trash2 className="w-3 h-3" />
            Delete folder
          </button>
        </div>
      )}
    </div>
  )
}
