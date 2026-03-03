import PptxGenJS from 'pptxgenjs'
import type { StructuredSlide, PresentationTheme } from '../../shared/types'

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return null
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  }
}

function cleanHex(color: string): string {
  // pptxgenjs expects hex without # and without rgba
  if (color.startsWith('#')) return color.slice(1)
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    // fallback to white or black
    return 'FFFFFF'
  }
  return color
}

export async function renderSlidesToPptx(slides: StructuredSlide[], theme: PresentationTheme): Promise<Buffer> {
  const pptx = new PptxGenJS()

  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches
  pptx.author = 'DeepNote AI'

  // Set theme colors
  const bg = cleanHex(theme.colors.background)
  const accent1 = cleanHex(theme.colors.accent1)
  const accent2 = cleanHex(theme.colors.accent2)
  const textPrimary = cleanHex(theme.colors.textPrimary)
  const textSecondary = cleanHex(theme.colors.textSecondary)
  const textMuted = cleanHex(theme.colors.textMuted)
  const fontHeading = theme.fonts.heading || 'Inter'
  const fontBody = theme.fonts.body || 'Inter'

  for (const slide of slides) {
    const pptSlide = pptx.addSlide()
    pptSlide.background = { color: bg }

    // Add a subtle gradient accent bar at top
    pptSlide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.05,
      fill: { color: accent1 },
    })

    switch (slide.layout) {
      case 'title-slide': {
        pptSlide.addText(slide.title, {
          x: 1, y: 2, w: 11, h: 2,
          fontSize: 44, fontFace: fontHeading, bold: true,
          color: textPrimary, align: 'center',
        })
        if (slide.subtitle) {
          pptSlide.addText(slide.subtitle, {
            x: 2, y: 4.2, w: 9, h: 1,
            fontSize: 20, fontFace: fontBody,
            color: textMuted, align: 'center',
          })
        }
        // Decorative accent line
        pptSlide.addShape(pptx.ShapeType.rect, {
          x: 5.5, y: 4, w: 2, h: 0.04,
          fill: { color: accent2 },
        })
        break
      }

      case 'section-header': {
        pptSlide.addText(slide.title, {
          x: 1, y: 2.5, w: 11, h: 2,
          fontSize: 36, fontFace: fontHeading, bold: true,
          color: textPrimary, align: 'center',
        })
        if (slide.subtitle) {
          pptSlide.addText(slide.subtitle, {
            x: 2, y: 4.5, w: 9, h: 1,
            fontSize: 18, fontFace: fontBody,
            color: textMuted, align: 'center',
          })
        }
        break
      }

      case 'content': {
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11.5, h: 0.8,
          fontSize: 28, fontFace: fontHeading, bold: true,
          color: textPrimary,
        })
        let yPos = 1.5
        for (const item of slide.bodyContent) {
          if (item.type === 'text' && item.text) {
            pptSlide.addText(item.text, {
              x: 0.8, y: yPos, w: 11.5, h: 1,
              fontSize: 16, fontFace: fontBody,
              color: textSecondary, valign: 'top',
            })
            yPos += 1.2
          } else if (item.type === 'bullets' && item.bullets) {
            const bulletText = item.bullets.map(b => ({ text: b, options: { bullet: true, indentLevel: 0 } }))
            pptSlide.addText(bulletText as PptxGenJS.TextProps[], {
              x: 0.8, y: yPos, w: 11.5, h: Math.max(1, item.bullets.length * 0.5),
              fontSize: 16, fontFace: fontBody,
              color: textSecondary, valign: 'top',
              paraSpaceAfter: 8,
            })
            yPos += item.bullets.length * 0.45 + 0.5
          }
        }
        break
      }

      case 'two-column': {
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11.5, h: 0.8,
          fontSize: 28, fontFace: fontHeading, bold: true,
          color: textPrimary,
        })
        const leftItems = slide.bodyContent.slice(0, Math.ceil(slide.bodyContent.length / 2))
        const rightItems = slide.bodyContent.slice(Math.ceil(slide.bodyContent.length / 2))

        let leftY = 1.5
        for (const item of leftItems) {
          if (item.type === 'bullets' && item.bullets) {
            const bulletText = item.bullets.map(b => ({ text: b, options: { bullet: true } }))
            pptSlide.addText(bulletText as PptxGenJS.TextProps[], {
              x: 0.8, y: leftY, w: 5.5, h: Math.max(1, item.bullets.length * 0.5),
              fontSize: 15, fontFace: fontBody, color: textSecondary, paraSpaceAfter: 6,
            })
          } else if (item.type === 'text' && item.text) {
            pptSlide.addText(item.text, {
              x: 0.8, y: leftY, w: 5.5, h: 1,
              fontSize: 15, fontFace: fontBody, color: textSecondary,
            })
          }
          leftY += 1.5
        }

        let rightY = 1.5
        for (const item of rightItems) {
          if (item.type === 'bullets' && item.bullets) {
            const bulletText = item.bullets.map(b => ({ text: b, options: { bullet: true } }))
            pptSlide.addText(bulletText as PptxGenJS.TextProps[], {
              x: 7, y: rightY, w: 5.5, h: Math.max(1, item.bullets.length * 0.5),
              fontSize: 15, fontFace: fontBody, color: textSecondary, paraSpaceAfter: 6,
            })
          } else if (item.type === 'text' && item.text) {
            pptSlide.addText(item.text, {
              x: 7, y: rightY, w: 5.5, h: 1,
              fontSize: 15, fontFace: fontBody, color: textSecondary,
            })
          }
          rightY += 1.5
        }
        break
      }

      case 'card-grid': {
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11.5, h: 0.8,
          fontSize: 28, fontFace: fontHeading, bold: true,
          color: textPrimary,
        })
        const cols = Math.min(slide.bodyContent.length, 3)
        const cardWidth = (12 - 0.5 * (cols - 1)) / cols
        slide.bodyContent.slice(0, 3).forEach((item, i) => {
          const x = 0.5 + i * (cardWidth + 0.5)
          // Card background
          pptSlide.addShape(pptx.ShapeType.roundRect, {
            x, y: 1.5, w: cardWidth, h: 5,
            fill: { color: bg, transparency: 80 },
            line: { color: accent1, width: 1, transparency: 70 },
            rectRadius: 0.15,
          })
          const cardTitle = item.type === 'stat' ? (item.statLabel || '') : (item.text?.split('.')[0] || '')
          const cardBody = item.type === 'stat' ? (item.statValue || '') : (item.text || item.bullets?.join('\n') || '')
          pptSlide.addText(cardTitle, {
            x: x + 0.3, y: 2, w: cardWidth - 0.6, h: 0.6,
            fontSize: 18, fontFace: fontHeading, bold: true, color: textPrimary,
          })
          pptSlide.addText(cardBody, {
            x: x + 0.3, y: 2.8, w: cardWidth - 0.6, h: 3,
            fontSize: 14, fontFace: fontBody, color: textSecondary, valign: 'top',
          })
        })
        break
      }

      case 'stat-row': {
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11.5, h: 0.8,
          fontSize: 28, fontFace: fontHeading, bold: true,
          color: textPrimary,
        })
        const statItems = slide.bodyContent.filter(b => b.type === 'stat')
        const statCols = Math.min(statItems.length, 4)
        const statWidth = (12 - 0.5 * (statCols - 1)) / statCols
        statItems.slice(0, 4).forEach((item, i) => {
          const x = 0.5 + i * (statWidth + 0.5)
          pptSlide.addShape(pptx.ShapeType.roundRect, {
            x, y: 2, w: statWidth, h: 4,
            fill: { color: bg, transparency: 80 },
            line: { color: accent1, width: 1, transparency: 70 },
            rectRadius: 0.15,
          })
          pptSlide.addText(item.statValue || '', {
            x, y: 2.5, w: statWidth, h: 1.5,
            fontSize: 40, fontFace: fontHeading, bold: true,
            color: accent1, align: 'center',
          })
          pptSlide.addText(item.statLabel || '', {
            x, y: 4.2, w: statWidth, h: 0.8,
            fontSize: 14, fontFace: fontBody,
            color: textMuted, align: 'center',
          })
        })
        break
      }

      case 'quote': {
        const quoteItem = slide.bodyContent.find(b => b.type === 'quote')
        if (quoteItem?.text) {
          pptSlide.addText(`"${quoteItem.text}"`, {
            x: 1.5, y: 2, w: 10, h: 3,
            fontSize: 24, fontFace: fontBody, italic: true,
            color: textSecondary, align: 'center', valign: 'middle',
          })
        }
        if (slide.subtitle) {
          pptSlide.addText(`— ${slide.subtitle}`, {
            x: 3, y: 5.2, w: 7, h: 0.6,
            fontSize: 16, fontFace: fontBody,
            color: textMuted, align: 'center',
          })
        }
        break
      }

      case 'closing': {
        pptSlide.addText(slide.title, {
          x: 1, y: 0.8, w: 11, h: 1.2,
          fontSize: 36, fontFace: fontHeading, bold: true,
          color: textPrimary, align: 'center',
        })
        const closingBullets = slide.bodyContent.find(b => b.type === 'bullets')
        if (closingBullets?.bullets) {
          const bulletText = closingBullets.bullets.map(b => ({ text: b, options: { bullet: true } }))
          pptSlide.addText(bulletText as PptxGenJS.TextProps[], {
            x: 2, y: 2.5, w: 9, h: 4,
            fontSize: 18, fontFace: fontBody,
            color: textSecondary, paraSpaceAfter: 12,
          })
        }
        break
      }

      default: {
        // Fallback: same as content
        pptSlide.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11.5, h: 0.8,
          fontSize: 28, fontFace: fontHeading, bold: true,
          color: textPrimary,
        })
        let yFallback = 1.5
        for (const item of slide.bodyContent) {
          if (item.type === 'text' && item.text) {
            pptSlide.addText(item.text, {
              x: 0.8, y: yFallback, w: 11.5, h: 1,
              fontSize: 16, fontFace: fontBody, color: textSecondary,
            })
            yFallback += 1.2
          }
        }
      }
    }

    // Speaker notes
    if (slide.notes) {
      pptSlide.addNotes(slide.notes)
    }
  }

  const output = await pptx.write({ outputType: 'nodebuffer' })
  return output as Buffer
}
