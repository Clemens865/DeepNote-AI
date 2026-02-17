import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, X, Loader2 } from 'lucide-react'

interface VoiceBarProps {
  notebookId: string
  onClose: () => void
  onUserMessage: (text: string) => void
  onAiMessage: (text: string) => void
}

// Convert Float32 audio samples to Int16 PCM
function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16
}

// Convert Int16 PCM to Float32 for Web Audio playback
function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff)
  }
  return float32
}

// Downsample from source sample rate to target (e.g. 48kHz → 16kHz)
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer
  const ratio = fromRate / toRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const idx = Math.round(i * ratio)
    result[i] = buffer[Math.min(idx, buffer.length - 1)]
  }
  return result
}

// ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function VoiceOverlay({ notebookId, onClose, onUserMessage, onAiMessage }: VoiceBarProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [aiSpeaking, setAiSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const cleanupRefs = useRef<Array<() => void>>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const playbackTimeRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const mutedRef = useRef(false)
  const pendingUserTextRef = useRef('')
  const pendingAiTextRef = useRef('')

  // Keep refs in sync
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // --- Audio Playback ---
  const playAudioChunk = useCallback((audioBase64: string, mimeType: string) => {
    const rateMatch = mimeType.match(/rate=(\d+)/)
    const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000

    if (!playbackCtxRef.current || playbackCtxRef.current.sampleRate !== sampleRate) {
      playbackCtxRef.current = new AudioContext({ sampleRate })
      playbackTimeRef.current = 0
    }
    const ctx = playbackCtxRef.current

    const pcmBuffer = base64ToArrayBuffer(audioBase64)
    const int16Data = new Int16Array(pcmBuffer)
    const float32Data = int16ToFloat32(int16Data)

    const audioBuffer = ctx.createBuffer(1, float32Data.length, sampleRate)
    audioBuffer.getChannelData(0).set(float32Data)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    const now = ctx.currentTime
    const startTime = Math.max(now, playbackTimeRef.current)
    source.start(startTime)
    playbackTimeRef.current = startTime + audioBuffer.duration
  }, [])

  // --- Start Session + Mic ---
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const result = await window.api.voiceStart({ notebookId })
        if (!mounted) return
        setSessionId(result.sessionId)

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        micStreamRef.current = stream

        const ctx = new AudioContext({ sampleRate: 16000 })
        audioContextRef.current = ctx
        const actualRate = ctx.sampleRate

        const micSource = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        micSource.connect(analyser)

        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (mutedRef.current || !sessionIdRef.current) return

          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setAudioLevel(avg / 255)

          const inputData = e.inputBuffer.getChannelData(0)
          const downsampled = downsample(inputData, actualRate, 16000)
          const pcm = float32ToInt16(downsampled)
          const base64 = arrayBufferToBase64(pcm.buffer as ArrayBuffer)

          window.api.voiceSendAudio({
            sessionId: sessionIdRef.current!,
            audioData: base64,
          })
        }

        micSource.connect(processor)
        processor.connect(ctx.destination)
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to start voice session')
        }
      }
    }

    init()

    // --- Listen for events ---
    const textCleanup = window.api.onVoiceResponseText(
      (data: { sessionId: string; text: string; type: string }) => {
        if (!mounted) return

        if (data.type === 'ready') {
          setConnected(true)
          return
        }
        if (data.type === 'error') {
          setError(data.text)
          return
        }
        if (data.type === 'input' && data.text) {
          pendingUserTextRef.current += data.text
        }
        if (data.type === 'output' && data.text) {
          setAiSpeaking(true)
          pendingAiTextRef.current += data.text
        }
      }
    )
    cleanupRefs.current.push(textCleanup)

    const audioCleanup = window.api.onVoiceResponseAudio(
      (data: { sessionId: string; audioData: string; mimeType: string }) => {
        if (!mounted) return
        setAiSpeaking(true)
        playAudioChunk(data.audioData, data.mimeType)
      }
    )
    cleanupRefs.current.push(audioCleanup)

    const turnCleanup = window.api.onVoiceTurnComplete(() => {
      if (!mounted) return
      setAiSpeaking(false)

      // Flush pending transcriptions to chat
      if (pendingUserTextRef.current.trim()) {
        onUserMessage(pendingUserTextRef.current.trim())
        pendingUserTextRef.current = ''
      }
      if (pendingAiTextRef.current.trim()) {
        onAiMessage(pendingAiTextRef.current.trim())
        pendingAiTextRef.current = ''
      }
    })
    cleanupRefs.current.push(turnCleanup)

    const interruptCleanup = window.api.onVoiceInterrupted(() => {
      if (!mounted) return
      setAiSpeaking(false)
      // Flush any partial AI text
      if (pendingAiTextRef.current.trim()) {
        onAiMessage(pendingAiTextRef.current.trim())
        pendingAiTextRef.current = ''
      }
      if (playbackCtxRef.current) {
        playbackCtxRef.current.close().catch(() => {})
        playbackCtxRef.current = null
        playbackTimeRef.current = 0
      }
    })
    cleanupRefs.current.push(interruptCleanup)

    return () => {
      mounted = false
      cleanupRefs.current.forEach((fn) => fn())
      cleanupRefs.current = []

      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
      }
      if (playbackCtxRef.current) {
        playbackCtxRef.current.close().catch(() => {})
        playbackCtxRef.current = null
      }
    }
  }, [notebookId, playAudioChunk, onUserMessage, onAiMessage])

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    // Flush any remaining text
    if (pendingUserTextRef.current.trim()) {
      onUserMessage(pendingUserTextRef.current.trim())
      pendingUserTextRef.current = ''
    }
    if (pendingAiTextRef.current.trim()) {
      onAiMessage(pendingAiTextRef.current.trim())
      pendingAiTextRef.current = ''
    }
    if (sessionId) {
      window.api.voiceStop({ sessionId }).catch(() => {})
    }
    onClose()
  }, [sessionId, onClose, onUserMessage, onAiMessage])

  // Animated level bars
  const bars = 5
  const barHeights = Array.from({ length: bars }, (_, i) => {
    if (!connected || muted) return 3
    if (aiSpeaking) return 6 + Math.sin(Date.now() / 200 + i * 0.8) * 8
    const base = audioLevel * 20
    return Math.max(3, base + Math.sin(Date.now() / 150 + i * 1.2) * (audioLevel * 6))
  })

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* Status indicator */}
      {!connected ? (
        <Loader2 size={14} className="text-indigo-400 animate-spin shrink-0" />
      ) : (
        <div className={`w-2 h-2 rounded-full shrink-0 ${aiSpeaking ? 'bg-indigo-500 animate-pulse' : muted ? 'bg-red-400' : 'bg-emerald-500 animate-pulse'}`} />
      )}

      {/* Status text */}
      <span className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0 truncate">
        {!connected
          ? 'Connecting...'
          : error
            ? error
            : aiSpeaking
              ? 'AI speaking...'
              : muted
                ? 'Muted'
                : 'Listening...'}
      </span>

      {/* Audio level bars */}
      <div className="flex items-center gap-0.5 h-4 shrink-0">
        {barHeights.map((h, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              aiSpeaking ? 'bg-indigo-400' : muted ? 'bg-slate-300 dark:bg-slate-600' : 'bg-emerald-400'
            }`}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>

      {/* Mute toggle */}
      <button
        onClick={toggleMute}
        disabled={!connected}
        className={`p-1.5 rounded-lg transition-colors shrink-0 ${
          muted
            ? 'bg-red-100 dark:bg-red-500/15 text-red-500 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/25'
            : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/25'
        } disabled:opacity-40`}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <MicOff size={14} /> : <Mic size={14} />}
      </button>

      {/* Close */}
      <button
        onClick={handleClose}
        className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
        title="End voice session"
      >
        <X size={14} />
      </button>
    </div>
  )
}
