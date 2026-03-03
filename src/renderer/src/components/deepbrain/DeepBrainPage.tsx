import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Brain, Activity, Network, Plug, Database, BookOpen } from 'lucide-react'
import { DashboardTab } from './DashboardTab'
import { KnowledgeGraphTab } from './KnowledgeGraphTab'
import { ConnectorsTab } from './ConnectorsTab'
import { MemoriesTab } from './MemoriesTab'
import { KnowledgeTab } from './KnowledgeTab'

type Tab = 'dashboard' | 'graph' | 'connectors' | 'memories' | 'knowledge'

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Activity className="w-4 h-4" /> },
  { id: 'graph', label: 'Knowledge Graph', icon: <Network className="w-4 h-4" /> },
  { id: 'connectors', label: 'Connectors', icon: <Plug className="w-4 h-4" /> },
  { id: 'memories', label: 'Memories', icon: <Database className="w-4 h-4" /> },
  { id: 'knowledge', label: 'Knowledge', icon: <BookOpen className="w-4 h-4" /> },
]

export function DeepBrainPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [available, setAvailable] = useState(false)
  const [uptimeMs, setUptimeMs] = useState(0)
  const [memoryCount, setMemoryCount] = useState(0)
  // Track whether we've ever connected — once connected, keep showing content
  // even during brief disconnects to avoid flashing
  const everConnected = useRef(false)
  const failCount = useRef(0)

  useEffect(() => {
    const check = async () => {
      try {
        const s = await window.api.deepbrainStatus()
        if (s?.available) {
          setAvailable(true)
          setUptimeMs(s.uptimeMs || 0)
          setMemoryCount(s.memoryCount || 0)
          everConnected.current = true
          failCount.current = 0
        } else {
          failCount.current++
          // Only mark as disconnected after 3 consecutive failures (30s)
          // to avoid flashing during brief timeouts
          if (failCount.current >= 3) {
            setAvailable(false)
          }
        }
      } catch {
        failCount.current++
        if (failCount.current >= 3) {
          setAvailable(false)
        }
      }
    }
    check()
    const interval = setInterval(check, 10_000)
    return () => clearInterval(interval)
  }, [])

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / 3_600_000)
    const minutes = Math.floor((ms % 3_600_000) / 60_000)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Show content if currently available OR if we've ever connected (graceful degradation)
  const showContent = available || everConnected.current

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-black/30 backdrop-blur-xl shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </button>

        <div className="w-px h-5 bg-black/[0.08] dark:bg-white/[0.08]" />

        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-500" />
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">DeepBrain Control Center</h1>
        </div>

        <div className="flex items-center gap-2 ml-auto text-xs text-zinc-500 dark:text-zinc-400">
          <span className={`w-2 h-2 rounded-full ${available ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
          {available ? (
            <>
              <span>Connected</span>
              <span className="text-zinc-400 dark:text-zinc-500">·</span>
              <span>Uptime {formatUptime(uptimeMs)}</span>
              <span className="text-zinc-400 dark:text-zinc-500">·</span>
              <span>{memoryCount.toLocaleString()} memories</span>
            </>
          ) : everConnected.current ? (
            <span className="text-amber-500">Reconnecting...</span>
          ) : (
            <span>Not connected</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 pt-3 pb-0 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-violet-600 dark:text-violet-400 border-violet-500 bg-white dark:bg-zinc-900'
                : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-900/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {!showContent ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500 dark:text-zinc-400">
            <Brain className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
            <p className="text-lg font-medium">DeepBrain is not connected</p>
            <p className="text-sm">Make sure DeepBrain is running on port 19519</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'graph' && <KnowledgeGraphTab />}
            {activeTab === 'connectors' && <ConnectorsTab />}
            {activeTab === 'memories' && <MemoriesTab />}
            {activeTab === 'knowledge' && <KnowledgeTab />}
          </>
        )}
      </div>
    </div>
  )
}
