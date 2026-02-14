export interface Notebook {
  id: string
  title: string
  emoji: string
  description: string
  chatMode: 'auto' | 'custom'
  responseLength: 'short' | 'medium' | 'long'
  workspaceRootPath: string | null
  cardBgImage?: string | null
  cardGradientFrom?: string | null
  cardGradientTo?: string | null
  createdAt: string
  updatedAt: string
  sourceCount?: number
}

// Workspace types
export type WorkspaceFileStatus = 'unindexed' | 'indexed' | 'stale' | 'error'

export interface WorkspaceFile {
  id: string
  notebookId: string
  relativePath: string
  fileSize: number
  mtimeMs: number
  contentHash: string | null
  sourceId: string | null
  status: WorkspaceFileStatus
  createdAt: string
  updatedAt: string
}

export interface WorkspaceTreeNode {
  name: string
  relativePath: string
  isDirectory: boolean
  children?: WorkspaceTreeNode[]
  fileSize?: number
  mtimeMs?: number
  status?: WorkspaceFileStatus
  sourceId?: string | null
  isIndexable?: boolean
}

export interface WorkspaceDiffResult {
  added: string[]
  modified: string[]
  deleted: string[]
  unchanged: number
}

export type SourceType = 'pdf' | 'docx' | 'txt' | 'md' | 'url' | 'youtube' | 'paste' | 'audio' | 'xlsx' | 'csv' | 'image' | 'pptx'

export interface Source {
  id: string
  notebookId: string
  title: string
  filename: string | null
  type: SourceType
  content: string
  rawFilePath: string | null
  isSelected: boolean
  sourceGuide: string | null
  createdAt: string
}

export interface Chunk {
  id: string
  sourceId: string
  text: string
  pageNumber: number | null
  chunkIndex: number
  tokenCount: number
  createdAt: string
}

export interface Note {
  id: string
  notebookId: string
  sourceId: string | null
  title: string
  content: string
  isConvertedToSource: boolean
  createdAt: string
  updatedAt: string
}

export type ChatRole = 'user' | 'assistant' | 'system'

export interface Citation {
  sourceId: string
  sourceTitle: string
  chunkText: string
  pageNumber?: number
}

export interface ChatMessage {
  id: string
  notebookId: string
  role: ChatRole
  content: string
  citations: Citation[]
  createdAt: string
}

export type GeneratedContentType =
  | 'audio'
  | 'video'
  | 'slides'
  | 'image-slides'
  | 'quiz'
  | 'flashcard'
  | 'mindmap'
  | 'infographic'
  | 'datatable'
  | 'report'
  | 'dashboard'
  | 'literature-review'
  | 'competitive-analysis'
  | 'diff'
  | 'citation-graph'

// Image Slides types
export interface SlideStylePreset {
  id: string
  name: string
  description: string
  promptSuffix: string
  negativePrompt: string
  colorPalette: string[]
}

export interface SlideElementLayout {
  type: 'title' | 'bullet' | 'text'
  content: string
  x: number        // % from left (0-100)
  y: number        // % from top (0-100)
  width: number    // % width (10-100)
  fontSize: number  // px
  align: 'left' | 'center' | 'right'
}

export interface SlideContentPlan {
  slideNumber: number
  title: string
  bullets: string[]
  content: string
  layout: string
  visualCue: string
  speakerNotes: string
  elementLayout?: SlideElementLayout[]
}

export interface ImageSlideData {
  slideNumber: number
  title: string
  bullets: string[]
  imagePath: string
  speakerNotes: string
}

export type SlideRenderMode = 'full-image' | 'hybrid'

export interface SlideTextElement {
  id: string
  type: 'title' | 'bullet' | 'text'
  content: string          // HTML from Tiptap
  x: number                // % from left (0-100)
  y: number                // % from top (0-100)
  width: number            // % width (10-100)
  style: {
    fontSize?: number      // px
    color?: string         // hex
    align?: 'left' | 'center' | 'right'
  }
}

export interface HybridSlideData {
  slideNumber: number
  title: string
  bullets: string[]
  imagePath: string
  speakerNotes: string
  layout: string
  elements?: SlideTextElement[]
  elementLayout?: SlideElementLayout[]
}

export interface ImageSlidesGeneratedData {
  style: string
  aspectRatio: string
  totalSlides: number
  slides: ImageSlideData[]
  contentPlan: SlideContentPlan[]
  renderMode?: SlideRenderMode
  hybridSlides?: HybridSlideData[]
  customPalette?: string[]
}

export interface ImageSlidesProgressEvent {
  generatedContentId: string
  stage: 'planning' | 'generating' | 'complete' | 'error'
  currentSlide?: number
  totalSlides?: number
  message: string
}

// Studio tool customization options
export interface StudioToolOptions {
  // Audio
  audioFormat?: 'deep-dive' | 'brief' | 'critique' | 'debate'
  // Flashcard
  cardCount?: 'fewer' | 'standard' | 'more'
  // Quiz
  questionCount?: 'fewer' | 'standard' | 'more'
  // Flashcard + Quiz
  difficulty?: 'easy' | 'medium' | 'hard'
  // Report
  reportFormat?: string
  // Mind Map
  mindmapDepth?: 'shallow' | 'standard' | 'deep'
  mindmapBranches?: 'fewer' | 'standard' | 'more'
  mindmapStyle?: 'overview' | 'detailed' | 'relationships'
  // Dashboard
  dashboardKpiCount?: 'fewer' | 'standard' | 'more'
  dashboardChartPreference?: 'mixed' | 'bar' | 'line' | 'pie'
  dashboardDensity?: 'compact' | 'standard' | 'full'
  // Citation Graph
  citationDetail?: 'key-connections' | 'standard' | 'comprehensive'
  citationTopicDepth?: 'overview' | 'standard' | 'detailed'
  // Shared
  length?: 'short' | 'default' | 'long'
  description?: string
}

// Report format suggestion
export interface ReportFormatSuggestion {
  title: string
  description: string
  prompt: string
}

export type GeneratedContentStatus = 'pending' | 'generating' | 'completed' | 'failed'

export interface GeneratedContent {
  id: string
  notebookId: string
  type: GeneratedContentType
  title: string
  data: Record<string, unknown>
  sourceIds: string[]
  status: GeneratedContentStatus
  createdAt: string
}
