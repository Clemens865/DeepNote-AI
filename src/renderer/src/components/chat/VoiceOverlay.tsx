import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, X, Loader2, Volume2 } from 'lucide-react'

interface VoiceOverlayProps {
  notebookId: string
  onClose: () => void
  onUserMessage?: (text: string) => void
  onAiMessage?: (text: string) => void
}

export function VoiceOverlay({ notebookId, onClose, onUserMessage, onAiMessage }: VoiceOverlayProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const cleanupRefs = useRef<Array<() => void>>([])
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // Start voice session
  useEffect(() => {
    let mounted = true

    async function initSession() {
      try {
        const result = await window.api.voiceStart({ notebookId })
        if (mounted) setSessionId(result.sessionId)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to start voice session')
      }
    }

    initSession()

    // Listen for responses
    const textCleanup = window.api.onVoiceResponseText((data) => {
      if (mounted) {
        setProcessing(false)
        if (data.type === 'transcription') {
          setTranscript((prev) => [...prev, `You: ${data.text}`])
          onUserMessage?.(data.text)
        } else {
          setTranscript((prev) => [...prev, data.text])
          onAiMessage?.(data.text)
        }
      }
    })
    cleanupRefs.current.push(textCleanup)

    const audioCleanup = window.api.onVoiceResponseAudio((data) => {
      if (mounted && data.audioData) {
        // Play the audio response from base64 data
        const audio = new Audio(`data:${data.mimeType};base64,${data.audioData}`)
        audio.play().catch(() => {})
      }
    })
    cleanupRefs.current.push(audioCleanup)

    return () => {
      mounted = false
      cleanupRefs.current.forEach((fn) => fn())
      cleanupRefs.current = []
    }
  }, [notebookId])

  const startRecording = useCallback(async () => {
    if (!sessionId) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Convert to base64
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1]
          if (base64 && sessionId) {
            setProcessing(true)
            try {
              await window.api.voiceSendAudio({ sessionId, audioData: base64 })
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to send audio')
              setProcessing(false)
            }
          }
        }
        reader.readAsDataURL(audioBlob)
      }

      mediaRecorder.start()
      setRecording(true)
      setError(null)
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access.')
    }
  }, [sessionId])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }, [recording])

  const handleClose = useCallback(() => {
    if (recording) stopRecording()
    if (sessionId) {
      window.api.voiceStop({ sessionId }).catch(() => {})
    }
    onClose()
  }, [recording, sessionId, stopRecording, onClose])

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X size={20} />
      </button>

      {/* Title */}
      <h2 className="text-white text-xl font-semibold mb-8">Voice Q&A</h2>

      {/* Waveform / Status */}
      <div className="mb-8 flex items-center justify-center">
        {recording ? (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-red-400 rounded-full animate-pulse"
                style={{
                  height: `${20 + Math.random() * 30}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.5s',
                }}
              />
            ))}
          </div>
        ) : processing ? (
          <Loader2 size={32} className="text-indigo-400 animate-spin" />
        ) : (
          <Volume2 size={32} className="text-white/40" />
        )}
      </div>

      {/* Record button */}
      <button
        onClick={recording ? stopRecording : startRecording}
        disabled={processing || !sessionId}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
          recording
            ? 'bg-red-500 hover:bg-red-600 scale-110'
            : 'bg-indigo-600 hover:bg-indigo-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {recording ? (
          <MicOff size={32} className="text-white" />
        ) : (
          <Mic size={32} className="text-white" />
        )}
      </button>

      <p className="text-white/50 text-sm mt-4">
        {recording ? 'Tap to stop recording' : processing ? 'Processing...' : 'Tap to start speaking'}
      </p>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm mt-4 max-w-sm text-center">{error}</p>
      )}

      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="mt-8 w-full max-w-lg max-h-48 overflow-auto rounded-xl bg-white/5 border border-white/10 p-4">
          {transcript.map((text, i) => (
            <p key={i} className="text-white/80 text-sm mb-2 leading-relaxed">
              {text}
            </p>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}
    </div>
  )
}
