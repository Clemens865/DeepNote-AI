import { useState, useEffect } from 'react'
import { Database, FolderSearch, Network } from 'lucide-react'
import { OverviewTab } from './OverviewTab'
import { KnowledgeTab } from './KnowledgeTab'
import { ConnectorsTab } from './ConnectorsTab'
import { KnowledgeGraphTab } from './KnowledgeGraphTab'

type Tab = 'overview' | 'knowledge' | 'connectors' | 'graph'

interface KnowledgeStatus {
  enabled: boolean
  total: number
  byType: Record<string, number>
  folderCount: number
}

export function KnowledgeHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [status, setStatus] = useState<KnowledgeStatus | null>(null)

  const loadStatus = async () => {
    try {
      const s = await window.api.knowledgeStatus()
      setStatus(s)
    } catch {
      setStatus(null)
    }
  }

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 15_000)
    return () => clearInterval(interval)
  }, [])

  const tabs: { id: Tab; label: string; icon: typeof Database }[] = [
    { id: 'overview', label: 'Overview', icon: Database },
    { id: 'knowledge', label: 'Knowledge', icon: Database },
    { id: 'connectors', label: 'Connectors', icon: FolderSearch },
    { id: 'graph', label: 'Graph', icon: Network },
  ]

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Hub</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {status ? `${status.total.toLocaleString()} memories` : 'Loading...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status?.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
            <span className="text-xs text-zinc-500">{status?.enabled ? 'Active' : 'Disabled'}</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && <OverviewTab status={status} onRefresh={loadStatus} />}
        {activeTab === 'knowledge' && <KnowledgeTab />}
        {activeTab === 'connectors' && <ConnectorsTab onRefresh={loadStatus} />}
        {activeTab === 'graph' && <KnowledgeGraphTab />}
      </div>
    </div>
  )
}
