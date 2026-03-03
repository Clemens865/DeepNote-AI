import { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Brain, FileText, Layers, Cpu, Zap, Clock, Activity, Network as NetworkIcon, HardDrive,
  Play, Sparkles, RotateCcw, Loader2, CheckCircle2, AlertTriangle, Combine,
} from 'lucide-react'

interface StatusData {
  memoryCount: number
  thoughtCount: number
  aiProvider: string
  aiAvailable: boolean
  embeddingProvider: string
  indexedFiles: number
  indexedChunks: number
  uptimeMs: number
  learningTrend: string
}

interface SonaStats {
  loopA: { active: boolean; gradientNorm: number; microLoraCount: number }
  loopB: { active: boolean; clusterCount: number; lastRun?: string }
  loopC: { active: boolean; ewcPenalty: number; lastRun?: string }
}

interface NervousStats {
  routerSync: number
  hopfieldEnergy: number
  oscillatorPhase: number
  predictiveCodingError: number
}

interface CompressionStats {
  hotTierSize: number
  warmTierSize: number
  coldTierSize: number
  compressionRatio: number
  totalRecords: number
}

interface LlmStatus {
  loaded: boolean
  backend: string
  modelName: string
  memoryUsageMb: number
  tokensProcessed: number
}

interface MemoryDistribution {
  name: string
  value: number
}

interface BrainCycleResult {
  cycleNumber: number
  trainingInsights: string[]
  memoriesPruned: number
}

interface BrainEvolveResult {
  adaptations: string[]
  improvements: string[]
  thoughtId?: string
}

interface BrainwireConsolidationResult {
  memoriesProcessed: number
  clustersFound: number
  memoriesConsolidated: number
  newAbstractions: number
  memoriesDecayed: number
}

interface BrainwireStatus {
  totalMemories: number
  activeMemories: number
  dormantMemories: number
  stmEntries: number
  consolidationCycles: number
  avgSalience: number
  workingMemoryItems: number
  conceptCount: number
}

const MEMORY_TYPE_COLORS: Record<string, string> = {
  semantic: '#8b5cf6',
  episodic: '#3b82f6',
  working: '#f59e0b',
  procedural: '#10b981',
  meta: '#ec4899',
  causal: '#f97316',
  goal: '#06b6d4',
  emotional: '#ef4444',
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatUptime = (ms: number) => {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Check if SONA stats indicate the subsystem is truly active (has non-zero values) */
const isSonaActive = (sona: SonaStats): boolean => {
  return sona.loopA.active || sona.loopB.active || sona.loopC.active
    || sona.loopA.gradientNorm > 0 || sona.loopA.microLoraCount > 0
    || sona.loopB.clusterCount > 0 || sona.loopC.ewcPenalty > 0
}

/** Check if Nervous System stats indicate the subsystem is truly active */
const isNervousActive = (nervous: NervousStats): boolean => {
  return nervous.routerSync > 0 || nervous.hopfieldEnergy !== 0
    || nervous.oscillatorPhase > 0 || nervous.predictiveCodingError > 0
}

/** Check if compression/storage has data */
const hasStorageData = (comp: CompressionStats): boolean => {
  return comp.hotTierSize > 0 || comp.warmTierSize > 0 || comp.coldTierSize > 0
    || comp.totalRecords > 0
}

export function DashboardTab() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [sona, setSona] = useState<SonaStats | null>(null)
  const [nervous, setNervous] = useState<NervousStats | null>(null)
  const [compression, setCompression] = useState<CompressionStats | null>(null)
  const [llm, setLlm] = useState<LlmStatus | null>(null)
  const [memoryDist, setMemoryDist] = useState<MemoryDistribution[]>([])

  // BrainWire state
  const [brainwire, setBrainwire] = useState<BrainwireStatus | null>(null)

  // Brain operations state
  const [actionRunning, setActionRunning] = useState<string | null>(null)
  const [lastCycleResult, setLastCycleResult] = useState<BrainCycleResult | null>(null)
  const [lastEvolveResult, setLastEvolveResult] = useState<BrainEvolveResult | null>(null)
  const [lastFlushOk, setLastFlushOk] = useState<boolean | null>(null)
  const [lastConsolidateResult, setLastConsolidateResult] = useState<BrainwireConsolidationResult | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, sonaRes, nervousRes, compressionRes, llmRes, bwRes] = await Promise.all([
        window.api.deepbrainStatus(),
        window.api.deepbrainSonaStats(),
        window.api.deepbrainNervousStats(),
        window.api.deepbrainCompressionStats(),
        window.api.deepbrainLlmStatus(),
        window.api.deepbrainBrainwireStatus(),
      ])
      if (statusRes) setStatus(statusRes)
      if (sonaRes) setSona(sonaRes)
      if (nervousRes) setNervous(nervousRes)
      if (compressionRes) setCompression(compressionRes)
      if (llmRes) setLlm(llmRes)
      if (bwRes) setBrainwire(bwRes)

      // Build memory distribution by sampling memories
      const sample = await window.api.deepbrainMemories({ offset: 0, limit: 500 })
      if (sample?.items?.length > 0) {
        const counts: Record<string, number> = {}
        for (const m of sample.items) {
          counts[m.memoryType] = (counts[m.memoryType] || 0) + 1
        }
        const dist = Object.entries(counts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
        setMemoryDist(dist)
      }
    } catch {
      // DeepBrain may have disconnected
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 10_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const handleCycle = async () => {
    setActionRunning('cycle')
    setLastCycleResult(null)
    try {
      const result = await window.api.deepbrainBrainCycle()
      if (result) setLastCycleResult(result)
      // Refresh stats after cycle
      fetchAll()
    } catch (err) {
      console.error('Cycle failed:', err)
    } finally {
      setActionRunning(null)
    }
  }

  const handleEvolve = async () => {
    setActionRunning('evolve')
    setLastEvolveResult(null)
    try {
      const result = await window.api.deepbrainBrainEvolve()
      if (result) setLastEvolveResult(result)
      fetchAll()
    } catch (err) {
      console.error('Evolve failed:', err)
    } finally {
      setActionRunning(null)
    }
  }

  const handleFlush = async () => {
    setActionRunning('flush')
    setLastFlushOk(null)
    try {
      const result = await window.api.deepbrainBrainFlush()
      setLastFlushOk(!!result)
      fetchAll()
    } catch (err) {
      console.error('Flush failed:', err)
      setLastFlushOk(false)
    } finally {
      setActionRunning(null)
    }
  }

  const handleConsolidate = async () => {
    setActionRunning('consolidate')
    setLastConsolidateResult(null)
    try {
      const result = await window.api.deepbrainBrainwireConsolidate()
      if (result) setLastConsolidateResult(result)
      fetchAll()
    } catch (err) {
      console.error('Consolidation failed:', err)
    } finally {
      setActionRunning(null)
    }
  }

  const storageTiers = compression && hasStorageData(compression)
    ? [
        { name: 'Hot', size: compression.hotTierSize },
        { name: 'Warm', size: compression.warmTierSize },
        { name: 'Cold', size: compression.coldTierSize },
      ]
    : []

  return (
    <div className="p-6 space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={<Brain className="w-4 h-4" />} label="Memories" value={status?.memoryCount?.toLocaleString() || '—'} color="text-violet-500" />
        <StatCard icon={<FileText className="w-4 h-4" />} label="Indexed Files" value={status?.indexedFiles?.toLocaleString() || '—'} color="text-blue-500" />
        <StatCard icon={<Layers className="w-4 h-4" />} label="Indexed Chunks" value={status?.indexedChunks?.toLocaleString() || '—'} color="text-emerald-500" />
        <StatCard icon={<Cpu className="w-4 h-4" />} label="AI Provider" value={status?.aiProvider || '—'} color="text-amber-500" dot={status?.aiAvailable} />
        <StatCard icon={<Zap className="w-4 h-4" />} label="Embeddings" value={status?.embeddingProvider || '—'} color="text-pink-500" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="Uptime" value={status ? formatUptime(status.uptimeMs) : '—'} color="text-cyan-500" />
      </div>

      {/* Brain Operations */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Brain Operations</h3>
          <span className="text-[10px] text-zinc-400 ml-2">Trigger cognitive processing, learning evolution, and memory consolidation</span>
        </div>

        <div className="flex items-start gap-3">
          <button
            onClick={handleCycle}
            disabled={actionRunning !== null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            title="Run a cognitive cycle — steps the oscillatory router, ticks SONA learning, and flushes MicroLoRA gradients. Every 100th cycle runs memory consolidation."
          >
            {actionRunning === 'cycle' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run Cycle
          </button>
          <button
            onClick={handleEvolve}
            disabled={actionRunning !== null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            title="Self-improvement pass — forces SONA learning, router adaptation, and memory evolution"
          >
            {actionRunning === 'evolve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Evolve
          </button>
          <button
            onClick={handleFlush}
            disabled={actionRunning !== null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            title="Flush all pending state to disk"
          >
            {actionRunning === 'flush' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Flush
          </button>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />
          <button
            onClick={handleConsolidate}
            disabled={actionRunning !== null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            title="BrainWire consolidation — clusters episodic memories, creates consolidated summaries, extracts semantic knowledge, and decays low-salience memories"
          >
            {actionRunning === 'consolidate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Combine className="w-3.5 h-3.5" />}
            Consolidate
          </button>
        </div>

        {/* Operation Results */}
        {lastCycleResult && (
          <div className="mt-3 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200/50 dark:border-violet-800/30">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Cycle #{lastCycleResult.cycleNumber} complete</span>
            </div>
            <p className="text-xs text-violet-600 dark:text-violet-400">
              {lastCycleResult.memoriesPruned > 0 && `${lastCycleResult.memoriesPruned} memories pruned. `}
              {lastCycleResult.trainingInsights.length > 0
                ? lastCycleResult.trainingInsights.join(' · ')
                : 'No training insights this cycle.'}
            </p>
          </div>
        )}

        {lastEvolveResult && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Evolution complete</span>
            </div>
            {lastEvolveResult.adaptations.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-0.5">
                Adaptations: {lastEvolveResult.adaptations.join(' · ')}
              </p>
            )}
            {lastEvolveResult.improvements.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Improvements: {lastEvolveResult.improvements.join(' · ')}
              </p>
            )}
            {lastEvolveResult.adaptations.length === 0 && lastEvolveResult.improvements.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">No adaptations or improvements needed.</p>
            )}
          </div>
        )}

        {lastFlushOk !== null && (
          <div className={`mt-3 p-3 rounded-lg border ${lastFlushOk
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30'
            : 'bg-red-50 dark:bg-red-950/20 border-red-200/50 dark:border-red-800/30'
          }`}>
            <div className="flex items-center gap-1.5">
              {lastFlushOk
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                : <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              }
              <span className={`text-xs font-medium ${lastFlushOk
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-300'
              }`}>
                {lastFlushOk ? 'All state flushed to disk' : 'Flush failed'}
              </span>
            </div>
          </div>
        )}

        {lastConsolidateResult && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">BrainWire consolidation complete</span>
            </div>
            <div className="grid grid-cols-5 gap-2 mt-2">
              <ConsolidateStat label="Processed" value={lastConsolidateResult.memoriesProcessed} />
              <ConsolidateStat label="Clusters" value={lastConsolidateResult.clustersFound} />
              <ConsolidateStat label="Consolidated" value={lastConsolidateResult.memoriesConsolidated} />
              <ConsolidateStat label="Abstractions" value={lastConsolidateResult.newAbstractions} />
              <ConsolidateStat label="Decayed" value={lastConsolidateResult.memoriesDecayed} />
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory Distribution */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Memory Distribution</h3>
          {memoryDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={memoryDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {memoryDist.map((entry) => (
                    <Cell key={entry.name} fill={MEMORY_TYPE_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-zinc-400">No memory data</div>
          )}
        </div>

        {/* Storage Tiers */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Storage Tiers</h3>
          {storageTiers.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={storageTiers}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={formatBytes} />
                  <Tooltip formatter={(value) => [formatBytes(value as number), 'Size']} />
                  <Bar dataKey="size" radius={[4, 4, 0, 0]}>
                    <Cell fill="#ef4444" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#3b82f6" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {compression && (
                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Compression ratio: {compression.compressionRatio.toFixed(2)}x</span>
                  <span>Total records: {compression.totalRecords.toLocaleString()}</span>
                </div>
              )}
            </>
          ) : (
            <div className="h-[240px] flex flex-col items-center justify-center gap-2">
              <HardDrive className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm text-zinc-400">No tiered storage data</p>
              <p className="text-xs text-zinc-400/70">Run a brain cycle or bootstrap to populate storage tiers</p>
            </div>
          )}
        </div>
      </div>

      {/* Subsystem Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* BrainWire Cognitive Memory */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Combine className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">BrainWire</h3>
          </div>
          {brainwire ? (
            brainwire.totalMemories > 0 || brainwire.consolidationCycles > 0 ? (
              <div className="space-y-3">
                <MetricRow label="Total Memories" value={brainwire.totalMemories.toLocaleString()} />
                <MetricRow label="Active" value={brainwire.activeMemories.toLocaleString()} />
                <MetricRow label="Dormant" value={brainwire.dormantMemories.toLocaleString()} />
                <MetricRow label="STM Entries" value={brainwire.stmEntries.toLocaleString()} />
                <MetricRow label="Consolidations" value={brainwire.consolidationCycles.toLocaleString()} />
                <MetricRow label="Avg Salience" value={brainwire.avgSalience.toFixed(3)} />
                <MetricRow label="Working Memory" value={brainwire.workingMemoryItems.toLocaleString()} />
                <MetricRow label="Concepts" value={brainwire.conceptCount.toLocaleString()} />
              </div>
            ) : (
              <InactivePanel
                message="BrainWire memory is empty"
                hint="Use 'Consolidate' to run multi-tier memory consolidation, or interact with DeepBrain to build cognitive memories"
              />
            )
          ) : (
            <p className="text-sm text-zinc-400">No data</p>
          )}
        </div>

        {/* SONA Learning */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">SONA Learning</h3>
          </div>
          {sona ? (
            isSonaActive(sona) ? (
              <div className="space-y-3">
                <LoopRow label="Loop A (MicroLoRA)" active={sona.loopA.active} details={`Grad norm: ${sona.loopA.gradientNorm.toFixed(4)} · ${sona.loopA.microLoraCount} adapters`} />
                <LoopRow label="Loop B (K-means++)" active={sona.loopB.active} details={`${sona.loopB.clusterCount} clusters${sona.loopB.lastRun ? ` · Last: ${sona.loopB.lastRun}` : ''}`} />
                <LoopRow label="Loop C (EWC++)" active={sona.loopC.active} details={`EWC penalty: ${sona.loopC.ewcPenalty.toFixed(4)}${sona.loopC.lastRun ? ` · Last: ${sona.loopC.lastRun}` : ''}`} />
              </div>
            ) : (
              <InactivePanel
                message="SONA learning loops are idle"
                hint="Run 'Evolve' or 'Run Cycle' to activate self-organizing neural adaptation"
              />
            )
          ) : (
            <p className="text-sm text-zinc-400">No data</p>
          )}
        </div>

        {/* Nervous System */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <NetworkIcon className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Nervous System</h3>
          </div>
          {nervous ? (
            isNervousActive(nervous) ? (
              <div className="space-y-3">
                <MetricRow label="Router Sync" value={`${(nervous.routerSync * 100).toFixed(1)}%`} />
                <MetricRow label="Hopfield Energy" value={nervous.hopfieldEnergy.toFixed(4)} />
                <MetricRow label="Oscillator Phase" value={`${(nervous.oscillatorPhase * 180 / Math.PI).toFixed(1)}°`} />
                <MetricRow label="Predictive Error" value={nervous.predictiveCodingError.toFixed(4)} />
              </div>
            ) : (
              <InactivePanel
                message="Nervous system is idle"
                hint="Cognitive cycles activate the oscillatory router, Hopfield network, and predictive coding"
              />
            )
          ) : (
            <p className="text-sm text-zinc-400">No data</p>
          )}
        </div>

        {/* LLM Status */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">LLM Status</h3>
          </div>
          {llm ? (
            llm.loaded ? (
              <div className="space-y-3">
                <MetricRow label="Status" value="Loaded" dot={true} />
                <MetricRow label="Backend" value={llm.backend || '—'} />
                <MetricRow label="Model" value={llm.modelName || '—'} />
                <MetricRow label="Memory" value={`${llm.memoryUsageMb.toFixed(0)} MB`} />
                <MetricRow label="Tokens" value={llm.tokensProcessed.toLocaleString()} />
              </div>
            ) : (
              <InactivePanel
                message="No local LLM loaded"
                hint={llm.backend && llm.backend !== 'none'
                  ? `Backend: ${llm.backend} — model not loaded yet`
                  : 'ruvllm local inference engine is not active'}
              />
            )
          ) : (
            <p className="text-sm text-zinc-400">No data</p>
          )}
        </div>
      </div>
    </div>
  )
}

function InactivePanel({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-4 gap-1.5">
      <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{message}</p>
      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">{hint}</p>
    </div>
  )
}

function StatCard({ icon, label, value, color, dot }: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
  dot?: boolean
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4">
      <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
        {icon}
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        {dot !== undefined && (
          <span className={`ml-auto w-1.5 h-1.5 rounded-full ${dot ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
        )}
      </div>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">{value}</p>
    </div>
  )
}

function LoopRow({ label, active, details }: { label: string; active: boolean; details: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-3.5">{details}</p>
    </div>
  )
}

function MetricRow({ label, value, dot }: { label: string; value: string; dot?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="flex items-center gap-1.5">
        {dot !== undefined && (
          <span className={`w-1.5 h-1.5 rounded-full ${dot ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
        )}
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{value}</span>
      </div>
    </div>
  )
}

function ConsolidateStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{value}</p>
      <p className="text-[10px] text-blue-500 dark:text-blue-400">{label}</p>
    </div>
  )
}
