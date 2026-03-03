import { useState, useEffect, useCallback } from 'react'
import {
  Plug, Play, CheckCircle2, XCircle, Loader2, FolderOpen,
  Globe, Mail, FileText, MessageSquare, BookOpen, Terminal,
  Chrome, Music, Video, Calendar, StickyNote, HardDrive, Archive,
} from 'lucide-react'

interface ConnectorInfo {
  id: string
  name: string
  description: string
  enabled: boolean
  detected: boolean
  detectionDetails?: string
  iconHint?: string
  configurable?: boolean
  pathOverride?: string
}

interface BootstrapResult {
  totalCreated: number
  totalSkipped: number
  totalErrors: number
  sources: { source: string; created: number; skipped: number; errors: number }[]
}

const CONNECTOR_ICONS: Record<string, React.ReactNode> = {
  chrome: <Chrome className="w-5 h-5" />,
  safari: <Globe className="w-5 h-5" />,
  brave: <Globe className="w-5 h-5" />,
  arc: <Globe className="w-5 h-5" />,
  firefox: <Globe className="w-5 h-5" />,
  obsidian: <BookOpen className="w-5 h-5" />,
  notes: <StickyNote className="w-5 h-5" />,
  mail: <Mail className="w-5 h-5" />,
  messages: <MessageSquare className="w-5 h-5" />,
  terminal: <Terminal className="w-5 h-5" />,
  music: <Music className="w-5 h-5" />,
  photos: <Video className="w-5 h-5" />,
  calendar: <Calendar className="w-5 h-5" />,
  finder: <FolderOpen className="w-5 h-5" />,
  documents: <FileText className="w-5 h-5" />,
  desktop: <HardDrive className="w-5 h-5" />,
  downloads: <Archive className="w-5 h-5" />,
}

function getConnectorIcon(connector: ConnectorInfo) {
  const hint = connector.iconHint?.toLowerCase() || connector.id.toLowerCase()
  for (const [key, icon] of Object.entries(CONNECTOR_ICONS)) {
    if (hint.includes(key)) return icon
  }
  return <Plug className="w-5 h-5" />
}

export function ConnectorsTab() {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [bootstrapRunning, setBootstrapRunning] = useState(false)
  const [bootstrapResult, setBootstrapResult] = useState<BootstrapResult | null>(null)
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchConnectors = useCallback(async () => {
    try {
      const list = await window.api.deepbrainConnectors()
      setConnectors(list || [])
    } catch {
      setConnectors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnectors()
  }, [fetchConnectors])

  const handleToggle = async (connector: ConnectorInfo) => {
    setTogglingId(connector.id)
    try {
      await window.api.deepbrainConnectorConfig({
        id: connector.id,
        enabled: !connector.enabled,
      })
      setConnectors((prev) =>
        prev.map((c) => (c.id === connector.id ? { ...c, enabled: !c.enabled } : c))
      )
    } catch (err) {
      console.error('Failed to toggle connector:', err)
    } finally {
      setTogglingId(null)
    }
  }

  const handlePathOverride = async (connector: ConnectorInfo, path: string) => {
    try {
      await window.api.deepbrainConnectorConfig({
        id: connector.id,
        pathOverride: path,
      })
      setConnectors((prev) =>
        prev.map((c) => (c.id === connector.id ? { ...c, pathOverride: path } : c))
      )
    } catch (err) {
      console.error('Failed to update path:', err)
    }
  }

  const toggleSource = (id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedSources(new Set(connectors.filter((c) => c.detected && c.enabled).map((c) => c.id)))
  }

  const handleBootstrap = async () => {
    const sources = Array.from(selectedSources)
    if (sources.length === 0) return

    setBootstrapRunning(true)
    setBootstrapResult(null)
    try {
      const result = await window.api.deepbrainBootstrap({ sources })
      setBootstrapResult(result)
    } catch (err) {
      console.error('Bootstrap failed:', err)
    } finally {
      setBootstrapRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  const detectedConnectors = connectors.filter((c) => c.detected)
  const undetectedConnectors = connectors.filter((c) => !c.detected)

  return (
    <div className="p-6 space-y-6">
      {/* Bootstrap Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Bootstrap</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Import knowledge from detected sources into DeepBrain
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
            >
              Select all
            </button>
            <button
              onClick={handleBootstrap}
              disabled={bootstrapRunning || selectedSources.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bootstrapRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {bootstrapRunning ? 'Running...' : 'Run Bootstrap'}
            </button>
          </div>
        </div>

        {/* Source checkboxes */}
        <div className="flex flex-wrap gap-2 mb-3">
          {connectors
            .filter((c) => c.detected && c.enabled)
            .map((c) => (
              <label
                key={c.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selectedSources.has(c.id)
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                    : 'border-black/[0.08] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSources.has(c.id)}
                  onChange={() => toggleSource(c.id)}
                  className="sr-only"
                />
                {c.name}
              </label>
            ))}
        </div>

        {/* Bootstrap result */}
        {bootstrapResult && (
          <div className="mt-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04]">
            <div className="flex items-center gap-4 text-xs mb-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Created: {bootstrapResult.totalCreated}
              </span>
              <span className="text-zinc-500">Skipped: {bootstrapResult.totalSkipped}</span>
              {bootstrapResult.totalErrors > 0 && (
                <span className="text-red-500">Errors: {bootstrapResult.totalErrors}</span>
              )}
            </div>
            <div className="space-y-1">
              {bootstrapResult.sources.map((s) => (
                <div key={s.source} className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300 w-24 truncate">{s.source}</span>
                  <span className="text-emerald-600">+{s.created}</span>
                  <span>~{s.skipped}</span>
                  {s.errors > 0 && <span className="text-red-500">!{s.errors}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detected Connectors */}
      {detectedConnectors.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Detected ({detectedConnectors.length})
          </h3>
          <div className="space-y-2">
            {detectedConnectors.map((c) => (
              <ConnectorCard
                key={c.id}
                connector={c}
                toggling={togglingId === c.id}
                onToggle={() => handleToggle(c)}
                onPathChange={(path) => handlePathOverride(c, path)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Not Detected */}
      {undetectedConnectors.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Not Detected ({undetectedConnectors.length})
          </h3>
          <div className="space-y-2">
            {undetectedConnectors.map((c) => (
              <ConnectorCard
                key={c.id}
                connector={c}
                toggling={togglingId === c.id}
                onToggle={() => handleToggle(c)}
                onPathChange={(path) => handlePathOverride(c, path)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectorCard({
  connector,
  toggling,
  onToggle,
  onPathChange,
}: {
  connector: ConnectorInfo
  toggling: boolean
  onToggle: () => void
  onPathChange: (path: string) => void
}) {
  const [showPath, setShowPath] = useState(false)
  const [pathValue, setPathValue] = useState(connector.pathOverride || '')

  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4 ${!connector.detected ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${connector.detected ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
          {getConnectorIcon(connector)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{connector.name}</span>
            {connector.detected ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{connector.description}</p>
          {connector.detectionDetails && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{connector.detectionDetails}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {connector.configurable && (
            <button
              onClick={() => setShowPath(!showPath)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Configure path"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}

          {/* Toggle */}
          <button
            onClick={onToggle}
            disabled={toggling}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              connector.enabled
                ? 'bg-violet-500'
                : 'bg-zinc-200 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                connector.enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {showPath && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={pathValue}
            onChange={(e) => setPathValue(e.target.value)}
            placeholder="Custom path (leave empty for default)"
            className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-black/[0.08] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 placeholder-zinc-400"
          />
          <button
            onClick={() => onPathChange(pathValue)}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  )
}
