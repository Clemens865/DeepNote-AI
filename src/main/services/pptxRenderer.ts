import PptxGenJS from 'pptxgenjs'
import { existsSync, readFileSync } from 'fs'
import type { StructuredSlide, PresentationTheme } from '../../shared/types'

function pptxColor(hex: string): string {
  return hex.replace('#', '')
}

export async function renderSlidesToPptx(
  slides: StructuredSlide[],
  theme: PresentationTheme
): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5
  pptx.author = 'DeepNote AI'

  const c = theme.colors
  const f = theme.fonts
  const bg = pptxColor(c.background)
  const accent1 = pptxColor(c.accent1)
  const accent2 = pptxColor(c.accent2)
  const textPrimary = pptxColor(c.textPrimary)
  const textSecondary = pptxColor(c.textSecondary)
  const textMuted = pptxColor(c.textMuted)

  // Template assets
  const tmpl = theme.pptxTemplate
  const bgImage = tmpl?.backgroundImageBase64
  const logoAsset = tmpl?.assets?.find((a) => a.role === 'logo')
  const decoAssets = tmpl?.assets?.filter((a) => a.role === 'decoration') || []

  for (const slide of slides) {
    const pptSlide = pptx.addSlide()

    // Apply background: image from template or solid color
    if (bgImage) {
      pptSlide.background = { data: bgImage }
    } else {
      pptSlide.background = { color: bg }
    }

    // Add logo to every slide if available (positioned in its original location)
    if (logoAsset) {
      pptSlide.addImage({
        data: logoAsset.base64,
        x: logoAsset.x ?? 0.3,
        y: logoAsset.y ?? 0.2,
        w: logoAsset.width ?? 1.2,
        h: logoAsset.height ?? 0.6,
      })
    }

    // Add decorative images (preserve original positions)
    for (const deco of decoAssets) {
      if (deco.x !== undefined && deco.y !== undefined && deco.width !== undefined && deco.height !== undefined) {
        pptSlide.addImage({
          data: deco.base64,
          x: deco.x,
          y: deco.y,
          w: deco.width,
          h: deco.height,
        })
      }
    }

    switch (slide.layout) {
      case 'title-slide': {
        // Accent bar at top
        pptSlide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 13.33, h: 0.05,
          fill: { color: accent1 },
        })
        pptSlide.addText(slide.title, {
          x: 1, y: 2, w: 11.33, h: 2,
          fontSize: 44, fontFace: f.heading, color: textPrimary,
          bold: true, align: 'center', valign: 'middle',
        })
        if (slide.subtitle) {
          pptSlide.addText(slide.subtitle, {
            x: 2, y: 4.2, w: 9.33, h: 1,
            fontSize: 20, fontFace: f.body, color: textSecondary,
            align: 'center', valign: 'top',
          })
        }
        break
      }

      case 'section-header': {
        pptSlide.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 3.2, w: 1.5, h: 0.06,
          fill: { color: accent1 },
        })
        pptSlide.addText(slide.title, {
          x: 0.8, y: 1.5, w: 11, h: 1.5,
          fontSize: 38, fontFace: f.heading, color: textPrimary,
          bold: true, align: 'left',
        })
        if (slide.subtitle) {
          pptSlide.addText(slide.subtitle, {
            x: 0.8, y: 3.5, w: 10, h: 1,
            fontSize: 18, fontFace: f.body, color: textSecondary,
          })
        }
        break
      }

      case 'content': {
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11, h: 0.8,
          fontSize: 28, fontFace: f.heading, color: textPrimary, bold: true,
        })
        let yPos = 1.4
        for (const item of slide.bodyContent) {
          if (item.type === 'image-placeholder' && item.imagePath && existsSync(item.imagePath)) {
            const imgData = `data:image/png;base64,${readFileSync(item.imagePath).toString('base64')}`
            const imgH = Math.min(4.5, 7.5 - yPos - 0.3)
            pptSlide.addImage({ data: imgData, x: 0.8, y: yPos, w: 11.5, h: imgH, sizing: { type: 'contain', w: 11.5, h: imgH } })
            yPos += imgH + 0.2
          } else if (item.type === 'text') {
            pptSlide.addText(item.text || '', {
              x: 0.8, y: yPos, w: 11.5, h: 1,
              fontSize: 16, fontFace: f.body, color: textSecondary,
              valign: 'top',
            })
            yPos += 1.1
          } else if (item.type === 'bullets') {
            const bulletText = (item.bullets || []).map((b) => ({
              text: b,
              options: { bullet: { code: '2022' }, fontSize: 16, color: textSecondary, fontFace: f.body },
            }))
            pptSlide.addText(bulletText as PptxGenJS.TextProps[], {
              x: 0.8, y: yPos, w: 11.5, h: Math.max(1, (item.bullets?.length || 1) * 0.45),
              valign: 'top',
            })
            yPos += Math.max(1.2, (item.bullets?.length || 1) * 0.5)
          }
        }
        break
      }

      case 'two-column': {
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11, h: 0.8,
          fontSize: 28, fontFace: f.heading, color: textPrimary, bold: true,
        })
        const half = Math.ceil(slide.bodyContent.length / 2)
        const leftItems = slide.bodyContent.slice(0, half)
        const rightItems = slide.bodyContent.slice(half)
        let ly = 1.5
        for (const item of leftItems) {
          if (item.type === 'image-placeholder' && item.imagePath && existsSync(item.imagePath)) {
            const imgData = `data:image/png;base64,${readFileSync(item.imagePath).toString('base64')}`
            pptSlide.addImage({ data: imgData, x: 0.8, y: ly, w: 5.5, h: 3, sizing: { type: 'contain', w: 5.5, h: 3 } })
            ly += 3.2
          } else {
            const text = item.type === 'bullets' ? (item.bullets || []).join('\n') : (item.text || '')
            pptSlide.addText(text, {
              x: 0.8, y: ly, w: 5.5, h: 1.2,
              fontSize: 15, fontFace: f.body, color: textSecondary, valign: 'top',
            })
            ly += 1.3
          }
        }
        let ry = 1.5
        for (const item of rightItems) {
          if (item.type === 'image-placeholder' && item.imagePath && existsSync(item.imagePath)) {
            const imgData = `data:image/png;base64,${readFileSync(item.imagePath).toString('base64')}`
            pptSlide.addImage({ data: imgData, x: 7, y: ry, w: 5.5, h: 3, sizing: { type: 'contain', w: 5.5, h: 3 } })
            ry += 3.2
          } else {
            const text = item.type === 'bullets' ? (item.bullets || []).join('\n') : (item.text || '')
            pptSlide.addText(text, {
              x: 7, y: ry, w: 5.5, h: 1.2,
              fontSize: 15, fontFace: f.body, color: textSecondary, valign: 'top',
            })
            ry += 1.3
          }
        }
        break
      }

      case 'card-grid': {
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11, h: 0.8,
          fontSize: 28, fontFace: f.heading, color: textPrimary, bold: true,
        })
        const cols = Math.min(slide.bodyContent.length, 3)
        const cardW = (11.5 - (cols - 1) * 0.4) / cols
        slide.bodyContent.slice(0, 6).forEach((item, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          const x = 0.8 + col * (cardW + 0.4)
          const y = 1.5 + row * 2.8
          if (item.type === 'image-placeholder' && item.imagePath && existsSync(item.imagePath)) {
            const imgData = `data:image/png;base64,${readFileSync(item.imagePath).toString('base64')}`
            pptSlide.addImage({ data: imgData, x, y, w: cardW, h: 2.4, sizing: { type: 'contain', w: cardW, h: 2.4 } })
          } else {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x, y, w: cardW, h: 2.4, rectRadius: 0.15,
              fill: { color: pptxColor(c.backgroundSecondary) },
              line: { color: textMuted, width: 0.5 },
            })
            const text = item.type === 'bullets'
              ? (item.bullets || []).map((b) => `  ${b}`).join('\n')
              : (item.text || item.statLabel || '')
            pptSlide.addText(text, {
              x: x + 0.2, y: y + 0.2, w: cardW - 0.4, h: 2,
              fontSize: 14, fontFace: f.body, color: textSecondary, valign: 'top',
            })
          }
        })
        break
      }

      case 'stat-row': {
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11, h: 0.8,
          fontSize: 28, fontFace: f.heading, color: textPrimary, bold: true,
        })
        const stats = slide.bodyContent.filter((c) => c.type === 'stat')
        const statW = Math.min(3, 11 / (stats.length || 1))
        const startX = (13.33 - stats.length * statW) / 2
        stats.forEach((item, i) => {
          const x = startX + i * statW
          pptSlide.addText(item.statValue || '', {
            x, y: 2.5, w: statW, h: 1.5,
            fontSize: 40, fontFace: f.heading, color: accent1,
            bold: true, align: 'center', valign: 'bottom',
          })
          pptSlide.addText(item.statLabel || '', {
            x, y: 4.2, w: statW, h: 0.8,
            fontSize: 14, fontFace: f.body, color: textMuted,
            align: 'center', valign: 'top',
          })
        })
        break
      }

      case 'quote': {
        const quoteItem = slide.bodyContent.find((c) => c.type === 'quote')
        pptSlide.addText(`"${quoteItem?.text || slide.title}"`, {
          x: 1.5, y: 2, w: 10, h: 2.5,
          fontSize: 26, fontFace: f.heading, color: textPrimary,
          italic: true, align: 'center', valign: 'middle',
        })
        if (slide.subtitle) {
          pptSlide.addText(`— ${slide.subtitle}`, {
            x: 2, y: 5, w: 9, h: 0.6,
            fontSize: 16, fontFace: f.body, color: textMuted,
            align: 'center',
          })
        }
        pptSlide.addShape(pptx.ShapeType.rect, {
          x: 5.5, y: 4.6, w: 2, h: 0.04,
          fill: { color: accent2 },
        })
        break
      }

      case 'closing': {
        pptSlide.addText(slide.title, {
          x: 1, y: 0.6, w: 11, h: 1.2,
          fontSize: 34, fontFace: f.heading, color: accent1,
          bold: true, align: 'center',
        })
        let cy = 2
        for (const item of slide.bodyContent) {
          if (item.type === 'image-placeholder' && item.imagePath && existsSync(item.imagePath)) {
            const imgData = `data:image/png;base64,${readFileSync(item.imagePath).toString('base64')}`
            const imgH = Math.min(3.5, 7.5 - cy - 0.3)
            pptSlide.addImage({ data: imgData, x: 1.5, y: cy, w: 10, h: imgH, sizing: { type: 'contain', w: 10, h: imgH } })
            cy += imgH + 0.2
          } else if (item.type === 'bullets') {
            const bulletText = (item.bullets || []).map((b) => ({
              text: b,
              options: { bullet: { code: '2713' }, fontSize: 18, color: textSecondary, fontFace: f.body },
            }))
            pptSlide.addText(bulletText as PptxGenJS.TextProps[], {
              x: 1.5, y: cy, w: 10, h: Math.max(1.5, (item.bullets?.length || 1) * 0.55),
              valign: 'top',
            })
            cy += Math.max(1.8, (item.bullets?.length || 1) * 0.6)
          } else {
            pptSlide.addText(item.text || '', {
              x: 1.5, y: cy, w: 10, h: 1,
              fontSize: 16, fontFace: f.body, color: textSecondary,
            })
            cy += 1.1
          }
        }
        break
      }

      default: {
        // Fallback content layout
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11, h: 0.8,
          fontSize: 28, fontFace: f.heading, color: textPrimary, bold: true,
        })
        pptSlide.addText(
          slide.bodyContent.map((bc) => bc.text || bc.bullets?.join('\n') || '').join('\n\n'),
          { x: 0.8, y: 1.5, w: 11.5, h: 5, fontSize: 16, fontFace: f.body, color: textSecondary, valign: 'top' }
        )
      }
    }

    if (slide.notes) {
      pptSlide.addNotes(slide.notes)
    }
  }

  const output = await pptx.write({ outputType: 'nodebuffer' })
  return output as Buffer
}
