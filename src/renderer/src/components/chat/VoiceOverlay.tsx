import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, X, Loader2 } from 'lucide-react'

interface VoiceOverlayProps {
  notebookId: string
  onClose: () => void
}

interface TranscriptEntry {
  role: 'user' | 'ai' | 'status'
  text: string
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

export function VoiceOverlay({ notebookId, onClose }: VoiceOverlayProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [aiSpeaking, setAiSpeaking] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const cleanupRefs = useRef<Array<() => void>>([])
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const playbackTimeRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const mutedRef = useRef(false)

  // Keep refs in sync
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // --- Audio Playback ---
  const playAudioChunk = useCallback((audioBase64: string, mimeType: string) => {
    // Parse sample rate from mimeType (e.g. "audio/pcm;rate=24000")
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

    // Schedule playback sequentially
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
        // 1. Start voice session (gets RAG context + connects to Gemini Live)
        const result = await window.api.voiceStart({ notebookId })
        if (!mounted) return
        setSessionId(result.sessionId)

        // 2. Start microphone capture
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

        // Create audio context (browser may not honor 16kHz, so we downsample)
        const ctx = new AudioContext({ sampleRate: 16000 })
        audioContextRef.current = ctx
        const actualRate = ctx.sampleRate

        const micSource = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        micSource.connect(analyser)

        // ScriptProcessor for capturing PCM chunks (4096 samples ~= 256ms at 16kHz)
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (mutedRef.current || !sessionIdRef.current) return

          // Get audio level for visualization
          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setAudioLevel(avg / 255)

          // Get raw audio and downsample to 16kHz if needed
          const inputData = e.inputBuffer.getChannelData(0)
          const downsampled = downsample(inputData, actualRate, 16000)
          const pcm = float32ToInt16(downsampled)
          const base64 = arrayBufferToBase64(pcm.buffer as ArrayBuffer)

          // Send to main process
          window.api.voiceSendAudio({
            sessionId: sessionIdRef.current!,
            audioData: base64,
          })
        }

        micSource.connect(processor)
        processor.connect(ctx.destination) // Required for ScriptProcessor to fire
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to start voice session'
          )
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

        if (data.type === 'input' && data.text.trim()) {
          setTranscript((prev) => {
            // Append to last user entry or create new one
            const last = prev[prev.length - 1]
            if (last?.role === 'user') {
              return [...prev.slice(0, -1), { role: 'user', text: last.text + data.text }]
            }
            return [...prev, { role: 'user', text: data.text }]
          })
        }

        if (data.type === 'output' && data.text.trim()) {
          setAiSpeaking(true)
          setTranscript((prev) => {
            // Append to last AI entry or create new one
            const last = prev[prev.length - 1]
            if (last?.role === 'ai') {
              return [...prev.slice(0, -1), { role: 'ai', text: last.text + data.text }]
            }
            return [...prev, { role: 'ai', text: data.text }]
          })
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
    })
    cleanupRefs.current.push(turnCleanup)

    const interruptCleanup = window.api.onVoiceInterrupted(() => {
      if (!mounted) return
      setAiSpeaking(false)
      // Clear playback queue
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

      // Clean up audio
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
  }, [notebookId, playAudioChunk])

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    if (sessionId) {
      window.api.voiceStop({ sessionId }).catch(() => {})
    }
    onClose()
  }, [sessionId, onClose])

  // Generate animated bars based on audio level
  const bars = 7
  const barHeights = Array.from({ length: bars }, (_, i) => {
    if (!connected || muted) return 4
    if (aiSpeaking) {
      // Gentle wave animation for AI speaking
      return 12 + Math.sin(Date.now() / 200 + i * 0.8) * 16
    }
    // React to actual mic input level
    const base = audioLevel * 40
    const variation = Math.sin(Date.now() / 150 + i * 1.2) * (audioLevel * 12)
    return Math.max(4, base + variation)
  })

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X size={20} />
      </button>

      {/* Title + Status */}
      <h2 className="text-white text-xl font-semibold mb-2">Live Voice</h2>
      <p className="text-white/40 text-xs mb-8">
        {!connected
          ? 'Connecting...'
          : aiSpeaking
            ? 'AI is speaking...'
            : muted
              ? 'Microphone muted'
              : 'Listening...'}
      </p>

      {/* Audio Visualization */}
      <div className="mb-8 flex items-center justify-center gap-1.5 h-16">
        {!connected ? (
          <Loader2 size={32} className="text-indigo-400 animate-spin" />
        ) : (
          barHeights.map((h, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-100 ${
                aiSpeaking
                  ? 'bg-indigo-400'
                  : muted
                    ? 'bg-white/20'
                    : 'bg-emerald-400'
              }`}
              style={{ height: `${h}px` }}
            />
          ))
        )}
      </div>

      {/* Mute button */}
      <button
        onClick={toggleMute}
        disabled={!connected}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
          muted
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-emerald-600 hover:bg-emerald-700 animate-pulse'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {muted ? (
          <MicOff size={32} className="text-white" />
        ) : (
          <Mic size={32} className="text-white" />
        )}
      </button>

      <p className="text-white/40 text-xs mt-3">
        {connected
          ? muted
            ? 'Tap to unmute'
            : 'Tap to mute'
          : 'Setting up...'}
      </p>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm mt-4 max-w-sm text-center">{error}</p>
      )}

      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="mt-6 w-full max-w-lg max-h-52 overflow-auto rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
          {transcript.map((entry, i) => (
            <div key={i} className="flex gap-2">
              <span
                className={`text-[10px] font-bold uppercase mt-0.5 shrink-0 ${
                  entry.role === 'user'
                    ? 'text-emerald-400'
                    : entry.role === 'ai'
                      ? 'text-indigo-400'
                      : 'text-white/30'
                }`}
              >
                {entry.role === 'user' ? 'You' : entry.role === 'ai' ? 'AI' : ''}
              </span>
              <p className="text-white/80 text-sm leading-relaxed">{entry.text}</p>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}
    </div>
  )
}
