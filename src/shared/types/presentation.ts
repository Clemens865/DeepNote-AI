export type PresentationSlideLayout =
  | 'title-slide'
  | 'section-header'
  | 'content'
  | 'two-column'
  | 'card-grid'
  | 'stat-row'
  | 'quote'
  | 'closing'

export interface SlideBodyContent {
  id: string
  type: 'text' | 'bullets' | 'stat' | 'quote' | 'image-placeholder'
  text?: string
  bullets?: string[]
  statValue?: string
  statLabel?: string
}

export interface StructuredSlide {
  id: string
  slideNumber: number
  layout: PresentationSlideLayout
  title: string
  subtitle?: string
  bodyContent: SlideBodyContent[]
  notes?: string
}

export interface PresentationThemeColors {
  background: string
  backgroundSecondary: string
  accent1: string
  accent2: string
  accent3: string
  textPrimary: string
  textSecondary: string
  textMuted: string
}

export interface PresentationTheme {
  name: string
  colors: PresentationThemeColors
  fonts: { heading: string; body: string; mono?: string }
  cssVariables?: Record<string, string>
  pptxTemplate?: PptxTemplateData
}

export interface PptxTemplateData {
  themeColors: Record<string, string>
  themeFonts: { heading: string; body: string }
  masterLayouts: {
    name: string
    placeholders: { type: string; x: number; y: number; w: number; h: number }[]
  }[]
  logoBase64?: string
}

export interface HtmlPresentationData {
  slides: StructuredSlide[]
  theme: PresentationTheme
  outputMode: 'html' | 'pptx'
  html?: string
  pptxPath?: string
}
