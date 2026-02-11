import { readFile } from 'fs/promises'
import { basename, extname } from 'path'
import { PDFParse } from 'pdf-parse'

const AUDIO_MIME_MAP: Record<string, string> = {
  '.mp3': 'audio/mp3',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
}

export class DocumentParserService {
  async parsePDF(filePath: string): Promise<{ text: string; title: string; pages: number }> {
    const buffer = await readFile(filePath)
    const pdf = new PDFParse({ data: new Uint8Array(buffer) })
    const textResult = await pdf.getText()
    await pdf.destroy()
    const title = basename(filePath, '.pdf')
    return { text: textResult.text, title, pages: textResult.total }
  }

  async parseDocx(filePath: string): Promise<{ text: string; title: string }> {
    const mammoth = await import('mammoth')
    const buffer = await readFile(filePath)
    const result = await mammoth.extractRawText({ buffer })
    const title = basename(filePath).replace(/\.docx?$/i, '')
    return { text: result.value, title }
  }

  async parseText(filePath: string): Promise<{ text: string; title: string }> {
    const text = await readFile(filePath, 'utf-8')
    const title = basename(filePath)
    return { text, title }
  }

  async parseUrl(url: string): Promise<{ text: string; title: string }> {
    const res = await fetch(url)
    const html = await res.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is)
    const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname

    // Extract body text: prefer <article>, fallback to <body>
    let bodyHtml = html
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    if (articleMatch) {
      bodyHtml = articleMatch[1]
    } else {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      if (bodyMatch) bodyHtml = bodyMatch[1]
    }

    // Strip HTML tags and normalize whitespace
    const text = bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()

    return { text, title }
  }

  async parseYoutube(url: string): Promise<{ text: string; title: string }> {
    const { GoogleGenAI } = await import('@google/genai')
    const { configService } = await import('./config')

    const apiKey = configService.getApiKey()
    if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Please extract the full transcript from this YouTube video. On the first line, output the video title prefixed with "TITLE: ". Then output the full transcript text.\n\nYouTube URL: ${url}`,
            },
          ],
        },
      ],
    })

    const responseText = response.text ?? ''
    if (!responseText.trim()) {
      throw new Error('Could not extract transcript from YouTube video.')
    }

    // Parse title from first line
    const lines = responseText.split('\n')
    let title = 'YouTube Video'
    let text = responseText

    if (lines[0]?.startsWith('TITLE:')) {
      title = lines[0].replace('TITLE:', '').trim()
      text = lines.slice(1).join('\n').trim()
    }

    return { text, title }
  }

  async parseAudio(filePath: string): Promise<{ text: string; title: string }> {
    const { GoogleGenAI } = await import('@google/genai')
    const { configService } = await import('./config')

    const apiKey = configService.getApiKey()
    if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')

    const ext = extname(filePath).toLowerCase()
    const mimeType = AUDIO_MIME_MAP[ext]
    if (!mimeType) {
      throw new Error(`Unsupported audio format: ${ext}`)
    }

    const buffer = await readFile(filePath)
    const base64 = buffer.toString('base64')

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: 'Please transcribe this audio file completely. Output only the transcript text, no additional commentary.',
            },
          ],
        },
      ],
    })

    const text = response.text ?? ''
    if (!text.trim()) {
      throw new Error('Could not transcribe audio file.')
    }

    const title = basename(filePath, ext)
    return { text, title }
  }
}

export const documentParserService = new DocumentParserService()
