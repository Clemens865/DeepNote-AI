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

export interface DeepBrainRecallItem {
  id: string
  content: string
  similarity: number
  memoryType: string
}

export interface DeepBrainFileResult {
  path: string
  name: string
  chunk: string
  similarity: number
  fileType: string
  project?: string
  modified?: string
}

export interface DeepBrainEmailResult {
  subject: string
  sender: string
  date: string
  chunk: string
  similarity: number
}

export interface DeepBrainResults {
  memories: DeepBrainRecallItem[]
  files: DeepBrainFileResult[]
  emails: DeepBrainEmailResult[]
}

export interface ChatMessage {
  id: string
  notebookId: string
  role: ChatRole
  content: string
  citations: Citation[]
  deepbrainResults?: DeepBrainResults
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
  | 'whitepaper'

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

// White Paper types
export interface WhitePaperSection {
  number: string
  title: string
  content: string
  imageDescription: string
  imagePath?: string
  imageCaption?: string
}

export interface WhitePaperReference {
  number: number
  citation: string
}

export interface WhitePaperData {
  title: string
  subtitle: string
  abstract: string
  date: string
  tableOfContents: { number: string; title: string }[]
  sections: WhitePaperSection[]
  references: WhitePaperReference[]
  keyFindings: string[]
  conclusion: string
  coverImagePath?: string
  style: string
}

export interface WhitePaperProgressEvent {
  generatedContentId: string
  stage: 'planning' | 'generating-cover' | 'generating-images' | 'complete' | 'error'
  currentSection?: number
  totalSections?: number
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
  // White Paper
  whitepaperTone?: 'academic' | 'business' | 'technical'
  whitepaperLength?: 'concise' | 'standard' | 'comprehensive'
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

// User Memory (cross-session)
export interface UserMemory {
  id: string
  notebookId: string | null
  type: 'preference' | 'learning' | 'context' | 'feedback'
  key: string
  value: string
  confidence: number
  lastUsedAt: string
  createdAt: string
  updatedAt: string
}

// Source Recommendations
export interface SourceRecommendation {
  notebookId: string
  notebookTitle: string
  sourceId: string
  sourceTitle: string
  score: number
}

// Studio generation pipeline progress
export interface StudioGenerationProgress {
  generatedContentId: string
  stage: 'researching' | 'writing' | 'reviewing' | 'revising' | 'complete'
  message: string
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
