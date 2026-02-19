import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { startVoiceSession, processAudioInput, stopVoiceSession } from '../services/voiceSession'

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
      // Process in background — responses come via broadcast events
      processAudioInput(args.sessionId, args.audioData).catch((err) =>
        console.error('[Voice] Audio processing failed:', err)
      )
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.VOICE_STOP,
    async (_event, args: { sessionId: string }) => {
      stopVoiceSession(args.sessionId)
    }
  )
}
