import { useState } from 'react'
import {
  ChevronRight, ChevronDown, File, FileText, FileCode, FileImage, FileAudio,
  Folder, FolderOpen, Loader2,
} from 'lucide-react'
import type { WorkspaceTreeNode } from '@shared/types'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'

interface FileTreeNodeProps {
  node: WorkspaceTreeNode
  depth: number
}

const EXT_ICON_MAP: Record<string, typeof File> = {
  '.ts': FileCode, '.tsx': FileCode, '.js': FileCode, '.jsx': FileCode,
  '.py': FileCode, '.go': FileCode, '.rs': FileCode, '.java': FileCode,
  '.html': FileCode, '.css': FileCode, '.scss': FileCode, '.json': FileCode,
  '.yaml': FileCode, '.yml': FileCode, '.toml': FileCode, '.xml': FileCode,
  '.md': FileText, '.txt': FileText, '.rst': FileText,
  '.png': FileImage, '.jpg': FileImage, '.jpeg': FileImage, '.gif': FileImage, '.svg': FileImage,
  '.mp3': FileAudio, '.wav': FileAudio, '.m4a': FileAudio, '.ogg': FileAudio,
}

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.rs',
  '.java', '.kt', '.scala', '.swift', '.c', '.cpp', '.h', '.hpp',
  '.md', '.markdown', '.txt', '.text', '.rst', '.org',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.xml', '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.sql', '.graphql', '.gql', '.vue', '.svelte', '.astro',
  '.csv', '.tsv', '.log', '.env', '.r',
  '.gitignore', '.dockerignore', '.editorconfig',
])

function getFileIcon(name: string) {
  const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : ''
  return EXT_ICON_MAP[ext] || File
}

function isTextFile(name: string): boolean {
  const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : ''
  // Dotfiles without extension (e.g. .gitignore)
  if (!ext && name.startsWith('.')) return true
  return TEXT_EXTENSIONS.has(ext)
}

export function FileTreeNode({ node, depth }: FileTreeNodeProps) {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const { expandedPaths, toggleExpanded, indexingPaths, addIndexing, removeIndexing, openEditor, editorTab } =
    useWorkspaceStore()
  const { setActiveView } = useAppStore()
  const [checkHover, setCheckHover] = useState(false)

  const isExpanded = expandedPaths.has(node.relativePath)
  const isIndexing = indexingPaths.has(node.relativePath)
  const isIndexed = node.status === 'indexed'
  const isStale = node.status === 'stale'
  const isActive = editorTab?.relativePath === node.relativePath

  if (node.isDirectory) {
    return (
      <div>
        <button
          onClick={() => toggleExpanded(node.relativePath)}
          className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm text-slate-600 dark:text-slate-300"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode key={child.relativePath} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // File node
  const Icon = getFileIcon(node.name)
  const canOpen = isTextFile(node.name)

  const handleCheckboxChange = async () => {
    if (!currentNotebook || isIndexing) return
    const notebookId = currentNotebook.id

    addIndexing(node.relativePath)
    try {
      if (isIndexed || isStale) {
        await window.api.workspaceDeselect({ notebookId, relativePath: node.relativePath })
      } else {
        await window.api.workspaceSelect({ notebookId, relativePath: node.relativePath })
      }
      // Refresh tree
      const tree = await window.api.workspaceScan(notebookId)
      useWorkspaceStore.getState().setTree(tree)
      // Refresh sources
      const sources = await window.api.listSources(notebookId)
      useNotebookStore.getState().setSources(sources as never[])
    } catch (err) {
      console.error('Indexing failed:', err)
    } finally {
      removeIndexing(node.relativePath)
    }
  }

  const handleClick = async () => {
    if (!currentNotebook || !canOpen) return

    // If already open, just switch to editor view
    if (isActive) {
      setActiveView('editor')
      return
    }

    // Warn about unsaved changes in current editor
    if (editorTab?.isDirty) {
      const ok = window.confirm('You have unsaved changes. Discard and open another file?')
      if (!ok) return
    }

    try {
      const result = await window.api.workspaceRead({
        notebookId: currentNotebook.id,
        relativePath: node.relativePath,
      })
      const { content, isText } = result as { content: string; isText: boolean }
      openEditor(node.relativePath, content, !isText)
      setActiveView('editor')
    } catch (err) {
      console.error('Failed to open file:', err)
    }
  }

  return (
    <div
      onClick={canOpen ? handleClick : undefined}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors group ${
        canOpen ? 'cursor-pointer' : 'cursor-default'
      } ${
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onMouseEnter={() => setCheckHover(true)}
      onMouseLeave={() => setCheckHover(false)}
    >
      {/* Checkbox for indexable files */}
      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {node.isIndexable && (
          isIndexing ? (
            <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
          ) : (
            <input
              type="checkbox"
              checked={isIndexed || isStale}
              onChange={handleCheckboxChange}
              className={`w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer ${
                !checkHover && !isIndexed && !isStale ? 'opacity-0' : 'opacity-100'
              } transition-opacity`}
            />
          )
        )}
      </div>

      <Icon className={`w-4 h-4 flex-shrink-0 ${
        isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
      }`} />
      <span className={`truncate text-sm ${
        isActive
          ? 'font-medium text-indigo-700 dark:text-indigo-300'
          : 'text-slate-600 dark:text-slate-300'
      }`}>
        {node.name}
      </span>

      {/* Status dot */}
      {isIndexed && (
        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 ml-auto" title="Indexed" />
      )}
      {isStale && (
        <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 ml-auto" title="Stale — needs re-index" />
      )}
    </div>
  )
}
