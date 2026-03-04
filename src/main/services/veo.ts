import { readFileSync } from 'fs'
import { GoogleGenAI } from '@google/genai'
import { configService } from './config'

function getClient(): GoogleGenAI {
  const apiKey = configService.getApiKey()
  if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')
  return new GoogleGenAI({ apiKey })
}

function getMimeType(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

export async function generateAnimationPrompt(imagePath: string): Promise<string> {
  const ai = getClient()
  const imageBytes = readFileSync(imagePath).toString('base64')
  const mimeType = getMimeType(imagePath)

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: imageBytes, mimeType } },
          {
            text: `You are an animation director. Analyze this infographic image and write a short animation prompt (2-3 sentences) describing how to bring it to life as a smooth, professional motion graphic. Describe camera movements, element animations, and transitions. Keep it concise and cinematic. Output ONLY the animation prompt text, nothing else.`,
          },
        ],
      },
    ],
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Failed to generate animation prompt')
  return text.trim()
}

export async function animateImage(
  imagePath: string,
  prompt: string,
  outputPath: string,
  onProgress?: (message: string) => void
): Promise<string> {
  const ai = getClient()
  const imageBytes = readFileSync(imagePath).toString('base64')
  const mimeType = getMimeType(imagePath)

  onProgress?.('Starting video generation with Veo 3.1...')

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-generate-preview',
    prompt,
    image: {
      imageBytes,
      mimeType,
    },
  })

  onProgress?.('Video generation in progress — polling for completion...')

  while (!operation.done) {
    await new Promise((r) => setTimeout(r, 10_000))
    operation = await ai.operations.getVideosOperation({ operation })
    onProgress?.('Still generating video...')
  }

  const generatedVideos = operation.response?.generatedVideos
  if (!generatedVideos || generatedVideos.length === 0) {
    throw new Error('Veo returned no generated videos')
  }

  const video = generatedVideos[0].video
  if (!video) {
    throw new Error('Veo returned no video file reference')
  }

  onProgress?.('Downloading generated video...')

  await ai.files.download({ file: video, downloadPath: outputPath })

  return outputPath
}
