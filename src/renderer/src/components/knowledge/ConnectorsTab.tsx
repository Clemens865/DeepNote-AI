import { useState, useEffect } from 'react'
import { FolderPlus, Trash2, Play, Loader2, FileText, Mail, MessageCircle } from 'lucide-react'

interface Folder {
  id: string
  path: string
  fileCount: number
  lastScanAt: number | null
  enabled: boolean
}

interface ScanProgress {
  stage: string
  message: string
  current?: number
  total?: number
}

interface Props {
  onRefresh: () => void
}

export function ConnectorsTab({ onRefresh }: Props) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [scanning, setScanning] = useState<string | null>(null)
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)

  const loadFolders = async () => {
    const result = await window.api.knowledgeFoldersGet()
    setFolders(result)
  }

  useEffect(() => {
    loadFolders()

    const cleanup = window.api.onKnowledgeScanProgress((data: ScanProgress) => {
      setScanProgress(data)
      if (data.stage === 'complete') {
        setScanning(null)
        loadFolders()
        onRefresh()
      }
    })

    return cleanup
  }, [])

  const handleAddFolder = async () => {
    const result = await window.api.knowledgeFoldersAdd()
    if (result) {
      loadFolders()
    }
  }

  const handleRemoveFolder = async (id: string) => {
    await window.api.knowledgeFoldersRemove({ id })
    loadFolders()
    onRefresh()
  }

  const handleScan = async (folderId: string) => {
    setScanning(folderId)
    setScanProgress({ stage: 'scanning', message: 'Starting scan...' })
    try {
      await window.api.knowledgeScan({ folderId })
    } catch (err) {
      console.error('Scan failed:', err)
    }
    setScanning(null)
    setScanProgress(null)
    loadFolders()
    onRefresh()
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Folder connectors */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between p-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Document Folders</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Indexes: MD, DOCX, PDF, TXT, XLSX, CSV, PPTX, RTF. Excludes: code files.
            </p>
          </div>
          <button
            onClick={handleAddFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Add Folder
          </button>
        </div>

        {folders.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            No folders configured. Click "Add Folder" to start indexing documents.
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {folders.map((folder) => (
              <div key={folder.id} className="p-4 flex items-center gap-3">
                <FileText className="w-4 h-4 text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{folder.path}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {folder.fileCount} files
                    {folder.lastScanAt && ` \u00B7 Last scan: ${new Date(folder.lastScanAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleScan(folder.id)}
                    disabled={scanning !== null}
                    className="p-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-600 dark:text-violet-400 transition-colors disabled:opacity-30"
                    title="Scan folder"
                  >
                    {scanning === folder.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRemoveFolder(folder.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-colors"
                    title="Remove folder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scan progress */}
      {scanning && scanProgress && (
        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300 capitalize">{scanProgress.stage}</span>
          </div>
          <p className="text-sm text-violet-600 dark:text-violet-400">{scanProgress.message}</p>
          {scanProgress.current != null && scanProgress.total != null && (
            <div className="mt-2 h-1.5 rounded-full bg-violet-200 dark:bg-violet-800 overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-full transition-all"
                style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Future connectors */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06]">
        <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Coming Soon</h3>
        </div>
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          <div className="p-4 flex items-center gap-3 opacity-50">
            <Mail className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">Mail</p>
              <p className="text-xs text-zinc-400">Index emails from Apple Mail</p>
            </div>
            <div className="flex-1" />
            <span className="text-[10px] text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">Coming soon</span>
          </div>
          <div className="p-4 flex items-center gap-3 opacity-50">
            <MessageCircle className="w-4 h-4 text-green-500" />
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">WhatsApp</p>
              <p className="text-xs text-zinc-400">Index exported WhatsApp conversations</p>
            </div>
            <div className="flex-1" />
            <span className="text-[10px] text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}
