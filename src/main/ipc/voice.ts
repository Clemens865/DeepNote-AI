import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { startVoiceSession, sendAudioChunk, stopVoiceSession } from '../services/voiceSession'

export function registerVoiceHandlers() {
  ipcMain.handle(
    IPC_CHANNELS.VOICE_START,
    async (_event, args: { notebookId: string }) => {
      return startVoiceSession(args.notebookId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.VOICE_SEND_AUDIO,
    async (_event, args: { sessionId: string; audioData: string }) => {
      // Forward PCM audio chunk to the live session in real-time
      sendAudioChunk(args.sessionId, args.audioData)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.VOICE_STOP,
    async (_event, args: { sessionId: string }) => {
      stopVoiceSession(args.sessionId)
    }
  )
}
