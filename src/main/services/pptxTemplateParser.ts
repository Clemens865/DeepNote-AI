import { readFile } from 'fs/promises'
import JSZip from 'jszip'
import type { PresentationTheme, PresentationThemeColors, PptxTemplateData, PptxTemplateAsset } from '../../shared/types'

function emuToInches(emu: number): number {
  return emu / 914400
}

function parseColorScheme(themeXml: string): Record<string, string> {
  const colors: Record<string, string> = {}
  const names = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']
  for (const name of names) {
    const sectionRe = new RegExp(`<a:${name}>[\\s\\S]*?<\\/a:${name}>`, 's')
    const section = themeXml.match(sectionRe)
    if (section) {
      const sectionText = section[0]
      // Match srgbClr or sysClr
      const srgb = sectionText.match(/val="([0-9A-Fa-f]{6})"/)
      if (srgb) {
        colors[name] = `#${srgb[1]}`
      } else {
        // System color fallback: <a:sysClr val="windowText" lastClr="000000"/>
        const sys = sectionText.match(/lastClr="([0-9A-Fa-f]{6})"/)
        if (sys) {
          colors[name] = `#${sys[1]}`
        }
      }
    }
  }
  return colors
}

function parseFontScheme(themeXml: string): { heading: string; body: string } {
  const majorMatch = themeXml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"[\s\S]*?<\/a:majorFont>/s)
  const minorMatch = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"[\s\S]*?<\/a:minorFont>/s)
  return {
    heading: majorMatch ? majorMatch[1] : 'Arial',
    body: minorMatch ? minorMatch[1] : 'Arial',
  }
}

function parsePlaceholders(layoutXml: string): { type: string; x: number; y: number; w: number; h: number }[] {
  const placeholders: { type: string; x: number; y: number; w: number; h: number }[] = []
  const phRe = /<p:sp\b[\s\S]*?<\/p:sp>/g
  let match: RegExpExecArray | null
  while ((match = phRe.exec(layoutXml)) !== null) {
    const spXml = match[0]
    const typeMatch = spXml.match(/<p:ph\s[^>]*type="([^"]*)"/)
    if (!typeMatch) continue
    const type = typeMatch[1]
    const offMatch = spXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/)
    const extMatch = spXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/)
    if (offMatch && extMatch) {
      placeholders.push({
        type,
        x: emuToInches(parseInt(offMatch[1])),
        y: emuToInches(parseInt(offMatch[2])),
        w: emuToInches(parseInt(extMatch[1])),
        h: emuToInches(parseInt(extMatch[2])),
      })
    }
  }
  return placeholders
}

/** Build a Map<rId, target> from a .rels XML file */
function buildRelsMap(relsXml: string): Map<string, string> {
  const map = new Map<string, string>()
  // Attributes can be in any order: Id, Target, Type
  const re = /<Relationship\s[^>]*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(relsXml)) !== null) {
    const tag = m[0]
    const idMatch = tag.match(/\bId="(rId\d+)"/)
    const targetMatch = tag.match(/\bTarget="([^"]+)"/)
    if (idMatch && targetMatch) {
      map.set(idMatch[1], targetMatch[1])
    }
  }
  return map
}

/** Resolve an rId to a base64 data URI using the rels map and zip archive */
async function resolveImageRel(
  rId: string,
  relsMap: Map<string, string>,
  zip: JSZip,
  basePath: string
): Promise<{ base64: string; mimeType: string } | null> {
  const target = relsMap.get(rId)
  if (!target) return null
  // Resolve relative path: target is often "../media/image1.png"
  let imgPath: string
  if (target.startsWith('/')) {
    imgPath = target.slice(1) // absolute within zip
  } else {
    imgPath = basePath + '/' + target
    // Normalize "../" references
    const parts = imgPath.split('/')
    const normalized: string[] = []
    for (const p of parts) {
      if (p === '..') normalized.pop()
      else if (p !== '.') normalized.push(p)
    }
    imgPath = normalized.join('/')
  }
  const imgFile = zip.file(imgPath)
  if (!imgFile) return null
  const imgData = await imgFile.async('base64')
  const ext = imgPath.split('.').pop()?.toLowerCase() || 'png'
  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', emf: 'image/emf',
    wmf: 'image/wmf', tiff: 'image/tiff', tif: 'image/tiff',
  }
  const mimeType = mimeMap[ext] || `image/${ext}`
  return { base64: `data:${mimeType};base64,${imgData}`, mimeType }
}

/** Extract images from an XML document (slide master or layout) */
async function extractAssetsFromXml(
  xml: string,
  relsMap: Map<string, string>,
  zip: JSZip,
  basePath: string
): Promise<{
  backgroundImage: { base64: string; mimeType: string } | null
  backgroundSolidColor: string | null
  pictures: PptxTemplateAsset[]
}> {
  let backgroundImage: { base64: string; mimeType: string } | null = null
  let backgroundSolidColor: string | null = null
  const pictures: PptxTemplateAsset[] = []

  // 1. Extract background
  const bgMatch = xml.match(/<p:bg[\s>][\s\S]*?<\/p:bg>/)
  if (bgMatch) {
    const bgXml = bgMatch[0]
    // Image background: <a:blipFill> with <a:blip r:embed="rIdX"/>
    const bgBlipMatch = bgXml.match(/<a:blip[^>]*r:embed="(rId\d+)"/)
    if (bgBlipMatch) {
      backgroundImage = await resolveImageRel(bgBlipMatch[1], relsMap, zip, basePath)
    }
    // Solid fill background: <a:solidFill><a:srgbClr val="FFFFFF"/>
    if (!backgroundImage) {
      const solidMatch = bgXml.match(/<a:solidFill>[\s\S]*?val="([0-9A-Fa-f]{6})"/)
      if (solidMatch) {
        backgroundSolidColor = `#${solidMatch[1]}`
      }
    }
  }

  // 2. Extract <p:pic> elements (logos, photos, decorative images)
  // Match <p:pic> with or without attributes/space
  const picRe = /<p:pic[\s>][\s\S]*?<\/p:pic>/g
  let picMatch: RegExpExecArray | null
  while ((picMatch = picRe.exec(xml)) !== null) {
    const picXml = picMatch[0]
    const blipMatch = picXml.match(/<a:blip[^>]*r:embed="(rId\d+)"/)
    if (!blipMatch) continue

    const offMatch = picXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/)
    const extMatch = picXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/)
    const x = offMatch ? emuToInches(parseInt(offMatch[1])) : undefined
    const y = offMatch ? emuToInches(parseInt(offMatch[2])) : undefined
    const w = extMatch ? emuToInches(parseInt(extMatch[1])) : undefined
    const h = extMatch ? emuToInches(parseInt(extMatch[2])) : undefined

    const nameMatch = picXml.match(/<p:cNvPr[^>]*\bname="([^"]*)"/)
    const picName = nameMatch ? nameMatch[1] : 'Image'

    const resolved = await resolveImageRel(blipMatch[1], relsMap, zip, basePath)
    if (!resolved) continue

    // Classify: small images < 3 inches = logo, larger = decoration
    const isSmall = w !== undefined && h !== undefined && w < 3 && h < 3
    const role: PptxTemplateAsset['role'] = isSmall ? 'logo' : 'decoration'

    pictures.push({
      name: picName,
      base64: resolved.base64,
      mimeType: resolved.mimeType,
      width: w,
      height: h,
      x,
      y,
      role,
    })
  }

  // 3. Extract image fills from non-placeholder shapes (<p:sp> with <a:blipFill>)
  const spRe = /<p:sp[\s>][\s\S]*?<\/p:sp>/g
  let spMatch: RegExpExecArray | null
  while ((spMatch = spRe.exec(xml)) !== null) {
    const spXml = spMatch[0]
    if (spXml.includes('<p:ph')) continue // skip placeholders
    const blipMatch = spXml.match(/<a:blipFill[\s>][\s\S]*?<a:blip[^>]*r:embed="(rId\d+)"/)
    if (!blipMatch) continue

    const offMatch = spXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/)
    const extMatch = spXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/)
    const nameMatch = spXml.match(/<p:cNvPr[^>]*\bname="([^"]*)"/)

    const resolved = await resolveImageRel(blipMatch[1], relsMap, zip, basePath)
    if (!resolved) continue

    pictures.push({
      name: nameMatch ? nameMatch[1] : 'Shape Image',
      base64: resolved.base64,
      mimeType: resolved.mimeType,
      width: extMatch ? emuToInches(parseInt(extMatch[1])) : undefined,
      height: extMatch ? emuToInches(parseInt(extMatch[2])) : undefined,
      x: offMatch ? emuToInches(parseInt(offMatch[1])) : undefined,
      y: offMatch ? emuToInches(parseInt(offMatch[2])) : undefined,
      role: 'decoration',
    })
  }

  return { backgroundImage, backgroundSolidColor, pictures }
}

/** Get the .rels file path for a given XML file */
function getRelsPath(xmlPath: string): string {
  const dir = xmlPath.substring(0, xmlPath.lastIndexOf('/'))
  const file = xmlPath.substring(xmlPath.lastIndexOf('/') + 1)
  return `${dir}/_rels/${file}.rels`
}

export async function parsePptxTemplate(filePath: string): Promise<PresentationTheme> {
  const buffer = await readFile(filePath)
  const zip = await JSZip.loadAsync(buffer)

  // Parse theme
  let themeColors: Record<string, string> = {}
  let themeFonts = { heading: 'Arial', body: 'Arial' }
  const themeFile = zip.file('ppt/theme/theme1.xml')
  if (themeFile) {
    const themeXml = await themeFile.async('text')
    themeColors = parseColorScheme(themeXml)
    themeFonts = parseFontScheme(themeXml)
  }

  // Parse slide layouts
  const masterLayouts: PptxTemplateData['masterLayouts'] = []
  const layoutFiles = Object.keys(zip.files)
    .filter((f) => f.startsWith('ppt/slideLayouts/') && f.endsWith('.xml') && !f.includes('_rels'))
    .sort()
  for (const lf of layoutFiles.slice(0, 8)) {
    const layoutXml = await zip.file(lf)!.async('text')
    const nameMatch = layoutXml.match(/<p:cSld\s[^>]*name="([^"]*)"/)
    const name = nameMatch ? nameMatch[1] : lf.replace('ppt/slideLayouts/', '').replace('.xml', '')
    const placeholders = parsePlaceholders(layoutXml)
    if (placeholders.length > 0) {
      masterLayouts.push({ name, placeholders })
    }
  }

  // Extract assets from slide masters AND slide layouts
  let logoBase64: string | undefined
  let backgroundImageBase64: string | undefined
  let backgroundSolidColor: string | null = null
  const assets: PptxTemplateAsset[] = []

  // Try slide masters first
  const masterXmlFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(f))
    .sort()

  for (const mf of masterXmlFiles) {
    const masterXml = await zip.file(mf)!.async('text')
    const relsPath = getRelsPath(mf)
    const relsFile = zip.file(relsPath)
    const relsMap = relsFile ? buildRelsMap(await relsFile.async('text')) : new Map<string, string>()
    const basePath = mf.substring(0, mf.lastIndexOf('/'))

    const result = await extractAssetsFromXml(masterXml, relsMap, zip, basePath)

    if (result.backgroundImage) {
      backgroundImageBase64 = result.backgroundImage.base64
      assets.push({
        name: 'Slide Master Background',
        base64: result.backgroundImage.base64,
        mimeType: result.backgroundImage.mimeType,
        role: 'background',
      })
    }
    if (result.backgroundSolidColor) {
      backgroundSolidColor = result.backgroundSolidColor
    }
    for (const pic of result.pictures) {
      if (pic.role === 'logo' && !logoBase64) {
        logoBase64 = pic.base64
      }
      assets.push(pic)
    }

    // Only process first slide master
    break
  }

  // Also check slide layouts for additional assets (many templates put images here)
  if (assets.length === 0) {
    for (const lf of layoutFiles.slice(0, 4)) {
      const layoutXml = await zip.file(lf)!.async('text')
      const relsPath = getRelsPath(lf)
      const relsFile = zip.file(relsPath)
      const relsMap = relsFile ? buildRelsMap(await relsFile.async('text')) : new Map<string, string>()
      const basePath = lf.substring(0, lf.lastIndexOf('/'))

      const result = await extractAssetsFromXml(layoutXml, relsMap, zip, basePath)

      if (result.backgroundImage && !backgroundImageBase64) {
        backgroundImageBase64 = result.backgroundImage.base64
        assets.push({
          name: `Layout Background (${lf})`,
          base64: result.backgroundImage.base64,
          mimeType: result.backgroundImage.mimeType,
          role: 'background',
        })
      }
      if (result.backgroundSolidColor && !backgroundSolidColor) {
        backgroundSolidColor = result.backgroundSolidColor
      }
      for (const pic of result.pictures) {
        if (pic.role === 'logo' && !logoBase64) {
          logoBase64 = pic.base64
        }
        assets.push(pic)
      }

      if (assets.length > 0) break
    }
  }

  // Also scan ppt/media/ directly for any images (fallback for templates that
  // embed images we missed via rels)
  const mediaFiles = Object.keys(zip.files).filter(
    (f) => f.startsWith('ppt/media/') && /\.(png|jpe?g|gif|svg|tiff?)$/i.test(f)
  )

  // Build PresentationTheme with CORRECT color mapping:
  // In OOXML: dk1 = dark text, lt1 = light background
  // For PPTX output we need light backgrounds and dark text
  const colors: PresentationThemeColors = {
    background: backgroundSolidColor || themeColors.lt1 || '#ffffff',
    backgroundSecondary: themeColors.lt2 || '#f1f5f9',
    accent1: themeColors.accent1 || '#6366f1',
    accent2: themeColors.accent2 || '#8b5cf6',
    accent3: themeColors.accent3 || '#06b6d4',
    textPrimary: themeColors.dk1 || '#1e293b',
    textSecondary: themeColors.dk2 || '#475569',
    textMuted: '#94a3b8',
  }

  return {
    name: 'Imported Template',
    colors,
    fonts: themeFonts,
    pptxTemplate: {
      themeColors,
      themeFonts,
      masterLayouts,
      logoBase64,
      backgroundImageBase64,
      assets,
      mediaFileCount: mediaFiles.length,
    },
  }
}
