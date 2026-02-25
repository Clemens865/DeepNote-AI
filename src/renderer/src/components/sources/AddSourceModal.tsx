import { useState } from 'react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Spinner } from '../common/Spinner'
import { useNotebookStore } from '../../stores/notebookStore'
import { FileText, Globe, ClipboardPaste, Youtube, Mic, Camera, Layers } from 'lucide-react'

interface AddSourceModalProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'file' | 'website' | 'paste' | 'youtube' | 'audio' | 'image' | 'pptx'

export function AddSourceModal({ isOpen, onClose }: AddSourceModalProps) {
  const [tab, setTab] = useState<Tab>('file')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [pasteTitle, setPasteTitle] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedPptx, setSelectedPptx] = useState<string | null>(null)
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const setSources = useNotebookStore((s) => s.setSources)

  const resetForm = () => {
    setSelectedFile(null)
    setUrl('')
    setPasteText('')
    setPasteTitle('')
    setYoutubeUrl('')
    setSelectedAudio(null)
    setSelectedImage(null)
    setSelectedPptx(null)
    setError(null)
  }

  const refreshSources = async () => {
    if (!currentNotebook) return
    const sources = await window.api.listSources(currentNotebook.id)
    setSources(sources as never[])
  }

  const handleFileSelect = async () => {
    const filePath = await window.api.showOpenDialog({
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'txt', 'md', 'xlsx', 'xls', 'csv'] },
      ],
    }) as string | null
    if (filePath) {
      setSelectedFile(filePath)
      setError(null)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile || !currentNotebook) return
    setLoading(true)
    setError(null)
    try {
      const ext = selectedFile.split('.').pop()?.toLowerCase() || 'txt'
      const type = ext === 'doc' ? 'docx' : ext === 'xls' ? 'xlsx' : ext
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type,
        filePath: selectedFile,
      })
      await refreshSources()
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setLoading(false)
    }
  }

  const handleUrlSubmit = async () => {
    if (!url.trim() || !currentNotebook) return
    setLoading(true)
    setError(null)
    try {
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type: 'url',
        url: url.trim(),
      })
      await refreshSources()
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setLoading(false)
    }
  }

  const handlePasteSubmit = async () => {
    if (!pasteText.trim() || !currentNotebook) return
    setLoading(true)
    setError(null)
    try {
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type: 'paste',
        content: pasteText.trim(),
        title: pasteTitle.trim() || undefined,
      })
      await refreshSources()
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setLoading(false)
    }
  }

  const handleYoutubeSubmit = async () => {
    if (!youtubeUrl.trim() || !currentNotebook) return
    setLoading(true)
    setError(null)
    try {
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type: 'youtube',
        url: youtubeUrl.trim(),
      })
      await refreshSources()
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setLoading(false)
    }
  }

  const handleAudioSelect = async () => {
    const filePath = await window.api.showOpenDialog({
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'] },
      ],
    }) as string | null
    if (filePath) {
      setSelectedAudio(filePath)
      setError(null)
    }
  }

  const handleAudioUpload = async () => {
    if (!selectedAudio || !currentNotebook) return
    setLoading(true)
    setError(null)
    try {
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type: 'audio',
        filePath: selectedAudio,
      })
      await refreshSources()
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = async () => {
    const filePath = await window.api.showOpenDialog({
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp'] },
      ],
    }) as string | null
    if (filePath) {
      setSelectedImage(filePath)
      setError(null)
    }
  }

  const handleImageUpload = async () => {
    if (!selectedImage || !currentNotebook) return
    setLoading(true)
    setError(null)
    try {
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type: 'image',
        filePath: selectedImage,
      })
      await refreshSources()
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setLoading(false)
    }
  }

  const handlePptxSelect = async () => {
    const filePath = await window.api.showOpenDialog({
      filters: [
        { name: 'PowerPoint', extensions: ['pptx', 'ppt'] },
      ],
    }) as string | null
    if (filePath) {
      setSelectedPptx(filePath)
      setError(null)
    }
  }

  const handlePptxUpload = async () => {
    if (!selectedPptx || !currentNotebook) return
    setLoading(true)
    setError(null)
    try {
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type: 'pptx',
        filePath: selectedPptx,
      })
      await refreshSources()
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'file', label: 'File', Icon: FileText },
    { id: 'website', label: 'Website', Icon: Globe },
    { id: 'paste', label: 'Paste', Icon: ClipboardPaste },
    { id: 'youtube', label: 'YouTube', Icon: Youtube },
    { id: 'audio', label: 'Audio', Icon: Mic },
    { id: 'image', label: 'Image', Icon: Camera },
    { id: 'pptx', label: 'PPTX', Icon: Layers },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add source">
      <div className="space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-xl overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(null) }}
              className={`flex shrink-0 items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                tab === t.id
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white font-medium shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'file' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Upload a PDF, DOCX, TXT, Markdown, Excel, or CSV file.
            </p>
            <button
              onClick={handleFileSelect}
              disabled={loading}
              className="w-full py-8 rounded-xl border-2 border-dashed border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-500/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              {selectedFile ? (
                <span className="text-sm">{selectedFile.split('/').pop()}</span>
              ) : (
                <span className="text-sm">Click to select a file...</span>
              )}
            </button>
            <Button
              onClick={handleFileUpload}
              disabled={!selectedFile || loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" /> Processing...
                </span>
              ) : (
                'Upload'
              )}
            </Button>
          </div>
        )}

        {tab === 'website' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Enter a URL to extract text content from a web page.
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50"
            />
            <Button
              onClick={handleUrlSubmit}
              disabled={!url.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" /> Fetching...
                </span>
              ) : (
                'Add Website'
              )}
            </Button>
          </div>
        )}

        {tab === 'paste' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Paste text content directly.
            </p>
            <input
              type="text"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="Title (optional)"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50"
            />
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your text here..."
              rows={6}
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50 resize-none"
            />
            <Button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" /> Processing...
                </span>
              ) : (
                'Add Text'
              )}
            </Button>
          </div>
        )}

        {tab === 'youtube' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Paste a YouTube URL to extract the video transcript via AI.
            </p>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50"
            />
            <Button
              onClick={handleYoutubeSubmit}
              disabled={!youtubeUrl.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" /> Extracting transcript...
                </span>
              ) : (
                'Add YouTube Video'
              )}
            </Button>
          </div>
        )}

        {tab === 'audio' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Upload an audio file (MP3, WAV, M4A, OGG, FLAC, AAC) to transcribe via AI.
            </p>
            <button
              onClick={handleAudioSelect}
              disabled={loading}
              className="w-full py-8 rounded-xl border-2 border-dashed border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-500/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              {selectedAudio ? (
                <span className="text-sm">{selectedAudio.split('/').pop()}</span>
              ) : (
                <span className="text-sm">Click to select an audio file...</span>
              )}
            </button>
            <Button
              onClick={handleAudioUpload}
              disabled={!selectedAudio || loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" /> Transcribing...
                </span>
              ) : (
                'Upload & Transcribe'
              )}
            </Button>
          </div>
        )}

        {tab === 'image' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Upload an image (photo, receipt, whiteboard, handwritten notes) to extract text via AI OCR.
            </p>
            <button
              onClick={handleImageSelect}
              disabled={loading}
              className="w-full py-8 rounded-xl border-2 border-dashed border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-500/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              {selectedImage ? (
                <span className="text-sm">{selectedImage.split('/').pop()}</span>
              ) : (
                <span className="text-sm">Click to select an image...</span>
              )}
            </button>
            <Button
              onClick={handleImageUpload}
              disabled={!selectedImage || loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" /> Extracting text...
                </span>
              ) : (
                'Upload & Extract'
              )}
            </Button>
          </div>
        )}

        {tab === 'pptx' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Upload a PowerPoint (.pptx) presentation to extract slide text and speaker notes via AI.
            </p>
            <button
              onClick={handlePptxSelect}
              disabled={loading}
              className="w-full py-8 rounded-xl border-2 border-dashed border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-500/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              {selectedPptx ? (
                <span className="text-sm">{selectedPptx.split('/').pop()}</span>
              ) : (
                <span className="text-sm">Click to select a PowerPoint file...</span>
              )}
            </button>
            <Button
              onClick={handlePptxUpload}
              disabled={!selectedPptx || loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" /> Processing slides...
                </span>
              ) : (
                'Upload & Extract'
              )}
            </Button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="px-3 py-2 rounded-lg text-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
