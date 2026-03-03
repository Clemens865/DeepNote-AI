import { readFile } from 'fs/promises'
import type { PresentationTheme } from '../../shared/types'

// jszip is available as a transitive dependency
let JSZip: typeof import('jszip') | null = null

async function getJSZip() {
  if (!JSZip) {
    JSZip = (await import('jszip')).default as unknown as typeof import('jszip')
  }
  return JSZip
}

function extractXmlAttribute(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i')
  const match = xml.match(regex)
  return match ? match[1] : null
}

function extractColorValue(xml: string, colorTag: string): string | null {
  // Look for <a:srgbClr val="RRGGBB"/> within the color tag
  const tagRegex = new RegExp(`<a:${colorTag}>[\\s\\S]*?<a:srgbClr\\s+val="([A-Fa-f0-9]{6})"`, 'i')
  const match = xml.match(tagRegex)
  return match ? `#${match[1]}` : null
}

function extractFontName(xml: string, fontTag: string): string | null {
  const regex = new RegExp(`<a:${fontTag}[^>]*typeface="([^"]*)"`, 'i')
  const match = xml.match(regex)
  return match ? match[1] : null
}

// EMU (English Metric Units) to inches: 1 inch = 914400 EMU
function emuToInches(emu: number): number {
  return Math.round((emu / 914400) * 100) / 100
}

export async function parsePptxTemplate(filePath: string): Promise<PresentationTheme> {
  const JSZipClass = await getJSZip()
  const fileBuffer = await readFile(filePath)
  const zip = await (JSZipClass as unknown as { loadAsync: (data: Buffer) => Promise<import('jszip')> }).loadAsync(fileBuffer)

  // Default theme
  const theme: PresentationTheme = {
    name: 'Custom Template',
    colors: {
      background: '#050510',
      backgroundSecondary: '#0a0a1a',
      accent1: '#6366f1',
      accent2: '#a855f7',
      accent3: '#ec4899',
      textPrimary: 'rgba(255,255,255,0.95)',
      textSecondary: 'rgba(255,255,255,0.85)',
      textMuted: 'rgba(255,255,255,0.5)',
    },
    fonts: { heading: 'Inter', body: 'Inter' },
    pptxTemplate: {
      themeColors: {},
      themeFonts: { heading: 'Inter', body: 'Inter' },
      masterLayouts: [],
    },
  }

  // Parse theme XML
  const themeFile = zip.file('ppt/theme/theme1.xml')
  if (themeFile) {
    const themeXml = await themeFile.async('text')

    // Extract color scheme
    const colorNames = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']
    for (const name of colorNames) {
      const color = extractColorValue(themeXml, name)
      if (color && theme.pptxTemplate) {
        theme.pptxTemplate.themeColors[name] = color
      }
    }

    // Map extracted colors to our theme
    if (theme.pptxTemplate) {
      const tc = theme.pptxTemplate.themeColors
      if (tc.dk1) theme.colors.background = tc.dk1
      if (tc.dk2) theme.colors.backgroundSecondary = tc.dk2
      if (tc.accent1) theme.colors.accent1 = tc.accent1
      if (tc.accent2) theme.colors.accent2 = tc.accent2
      if (tc.accent3) theme.colors.accent3 = tc.accent3
      if (tc.lt1) {
        theme.colors.textPrimary = tc.lt1
        theme.colors.textSecondary = tc.lt1
        theme.colors.textMuted = tc.lt1
      }
    }

    // Extract font scheme
    const majorFont = extractFontName(themeXml, 'latin') // First occurrence is typically major
    if (majorFont) {
      theme.fonts.heading = majorFont
      if (theme.pptxTemplate) theme.pptxTemplate.themeFonts.heading = majorFont
    }

    // Look for minor font (body)
    const minorMatch = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin\s+typeface="([^"]*)"/i)
    if (minorMatch) {
      theme.fonts.body = minorMatch[1]
      if (theme.pptxTemplate) theme.pptxTemplate.themeFonts.body = minorMatch[1]
    }
  }

  // Parse slide layouts for placeholder positions
  const layoutFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/slideLayouts/') && f.endsWith('.xml'))
  for (const layoutPath of layoutFiles.slice(0, 10)) {
    const layoutFile = zip.file(layoutPath)
    if (!layoutFile) continue
    const layoutXml = await layoutFile.async('text')

    const layoutName = extractXmlAttribute(layoutXml, 'p:cSld', 'name') || layoutPath.split('/').pop()?.replace('.xml', '') || 'unknown'
    const placeholders: { type: string; x: number; y: number; w: number; h: number }[] = []

    // Extract placeholder shapes — look for <p:sp> elements with <p:ph>
    const spMatches = layoutXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/gi)
    for (const spMatch of spMatches) {
      const spXml = spMatch[0]
      const phType = extractXmlAttribute(spXml, 'p:ph', 'type') || 'body'

      // Extract position from <a:off> and <a:ext>
      const offMatch = spXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/)
      const extMatch = spXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/)
      if (offMatch && extMatch) {
        placeholders.push({
          type: phType,
          x: emuToInches(parseInt(offMatch[1])),
          y: emuToInches(parseInt(offMatch[2])),
          w: emuToInches(parseInt(extMatch[1])),
          h: emuToInches(parseInt(extMatch[2])),
        })
      }
    }

    if (placeholders.length > 0 && theme.pptxTemplate) {
      theme.pptxTemplate.masterLayouts.push({ name: layoutName, placeholders })
    }
  }

  return theme
}
