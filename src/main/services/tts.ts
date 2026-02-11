import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { GoogleGenAI } from '@google/genai'
import { configService } from './config'

function getAudioCacheDir(): string {
  const dir = join(app.getPath('userData'), 'audio-cache')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function writeWavFile(pcmBuffer: Buffer, sampleRate: number, outputPath: string): void {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmBuffer.length
  const headerSize = 44

  const header = Buffer.alloc(headerSize)

  // RIFF header
  header.write('RIFF', 0)
  header.writeUInt32LE(dataSize + headerSize - 8, 4)
  header.write('WAVE', 8)

  // fmt subchunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // subchunk1 size
  header.writeUInt16LE(1, 20) // audio format (PCM)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  // data subchunk
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  const wavBuffer = Buffer.concat([header, pcmBuffer])
  writeFileSync(outputPath, wavBuffer)
}

export class TtsService {
  async generatePodcastAudio(
    script: { speakers: { name: string; voice: string }[]; turns: { speaker: string; text: string }[] }
  ): Promise<{ audioPath: string; duration: number }> {
    const apiKey = configService.getApiKey()
    if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')

    const ai = new GoogleGenAI({ apiKey })

    // Build script text with speaker annotations
    const scriptText = script.turns
      .map((turn) => `${turn.speaker}: ${turn.text}`)
      .join('\n\n')

    // Build multi-speaker voice config
    const speakerVoiceConfigs = script.speakers.map((s) => ({
      speaker: s.name,
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: s.voice,
        },
      },
    }))

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text: scriptText }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs,
          },
        },
      },
    })

    // Extract audio data from response
    const part = response.candidates?.[0]?.content?.parts?.[0]
    if (!part?.inlineData?.data) {
      throw new Error('No audio data returned from TTS API')
    }

    const pcmBuffer = Buffer.from(part.inlineData.data, 'base64')
    const sampleRate = 24000 // Gemini TTS default
    const outputPath = join(getAudioCacheDir(), `${randomUUID()}.wav`)

    writeWavFile(pcmBuffer, sampleRate, outputPath)

    // Calculate duration: PCM 16-bit mono = 2 bytes per sample
    const duration = pcmBuffer.length / (sampleRate * 2)

    return { audioPath: outputPath, duration }
  }
}

export const ttsService = new TtsService()
