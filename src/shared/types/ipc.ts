import type { Notebook, Source, Note, ChatMessage, GeneratedContent, WorkspaceFile, WorkspaceTreeNode, WorkspaceDiffResult, SlideRenderMode, SlideTextElement, ReportFormatSuggestion, UserMemory, SourceRecommendation, DeepBrainEmailResult, TokenUsageSummary, ImageModelId } from './index'

export const IPC_CHANNELS = {
  // Notebooks
  NOTEBOOKS_LIST: 'notebooks:list',
  NOTEBOOKS_CREATE: 'notebooks:create',
  NOTEBOOKS_GET: 'notebooks:get',
  NOTEBOOKS_UPDATE: 'notebooks:update',
  NOTEBOOKS_DELETE: 'notebooks:delete',
  NOTEBOOK_UPLOAD_COVER: 'notebooks:upload-cover',

  // Sources
  SOURCES_LIST: 'sources:list',
  SOURCES_ADD: 'sources:add',
  SOURCES_DELETE: 'sources:delete',
  SOURCES_TOGGLE: 'sources:toggle',

  // Notes
  NOTES_LIST: 'notes:list',
  NOTES_CREATE: 'notes:create',
  NOTES_UPDATE: 'notes:update',
  NOTES_DELETE: 'notes:delete',
  NOTES_TAGS: 'notes:tags',
  NOTES_BACKLINKS: 'notes:backlinks',
  NOTES_RESOLVE_LINK: 'notes:resolveLink',

  // Canvas
  CANVAS_SAVE: 'canvas:save',

  // Notebooks (extra)
  NOTEBOOKS_EXPORT: 'notebooks:export',

  // Deep Research
  DEEP_RESEARCH_START: 'deep-research:start',

  // Image Slides
  IMAGE_SLIDES_START: 'image-slides:start',
  IMAGE_SLIDES_UPDATE_TEXT: 'image-slides:update-text',

  // Chat
  CHAT_MESSAGES: 'chat:messages',
  CHAT_SEND: 'chat:send',
  CHAT_SAVE_MESSAGE: 'chat:saveMessage',
  CHAT_CLEAR: 'chat:clear',

  // Studio
  STUDIO_GENERATE: 'studio:generate',
  STUDIO_STATUS: 'studio:status',
  STUDIO_LIST: 'studio:list',
  STUDIO_DELETE: 'studio:delete',
  STUDIO_RENAME: 'studio:rename',

  // Studio (report format suggestions)
  STUDIO_SUGGEST_FORMATS: 'studio:suggestFormats',

  // Studio (infographic)
  INFOGRAPHIC_START: 'infographic:start',

  // Studio (white paper)
  WHITEPAPER_START: 'whitepaper:start',
  WHITEPAPER_EXPORT_PDF: 'whitepaper:exportPdf',

  // Studio (HTML presentation)
  STUDIO_SAVE_HTML: 'studio:saveHtml',
  STUDIO_OPEN_HTML_TEMP: 'studio:openHtmlTemp',
  HTML_PRESENTATION_START: 'html-presentation:start',

  // Config
  CONFIG_GET_API_KEY: 'config:getApiKey',
  CONFIG_SET_API_KEY: 'config:setApiKey',
  CONFIG_TEST_API_KEY: 'config:testApiKey',
  CONFIG_GET_CHAT_CONFIG: 'config:getChatConfig',
  CONFIG_SET_CHAT_CONFIG: 'config:setChatConfig',

  // Save file (copy local file to user-chosen destination)
  STUDIO_SAVE_FILE: 'studio:saveFile',
  STUDIO_EXPORT_PDF: 'studio:exportPdf',

  // Dialog
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',

  // Workspace
  WORKSPACE_LINK: 'workspace:link',
  WORKSPACE_UNLINK: 'workspace:unlink',
  WORKSPACE_SCAN: 'workspace:scan',
  WORKSPACE_DIFF: 'workspace:diff',
  WORKSPACE_SELECT: 'workspace:select',
  WORKSPACE_DESELECT: 'workspace:deselect',
  WORKSPACE_READ: 'workspace:read',
  WORKSPACE_WRITE: 'workspace:write',
  WORKSPACE_CREATE_FILE: 'workspace:createFile',
  WORKSPACE_DELETE_FILE: 'workspace:deleteFile',
  WORKSPACE_CREATE_DIR: 'workspace:createDir',
  WORKSPACE_FILES: 'workspace:files',
  WORKSPACE_SYNC: 'workspace:sync',

  // Editor AI
  EDITOR_AI_REWRITE: 'editor:ai-rewrite',

  // Memory
  MEMORY_LIST: 'memory:list',
  MEMORY_DELETE: 'memory:delete',
  MEMORY_CLEAR: 'memory:clear',

  // Chat-to-Source
  CHAT_GENERATE_FROM_CONTEXT: 'chat:generateFromContext',

  // Source Recommendations
  SOURCES_RECOMMENDATIONS: 'sources:recommendations',

  // Clipboard Quick-Capture
  CLIPBOARD_HISTORY: 'clipboard:history',
  CLIPBOARD_ADD_TO_NOTEBOOK: 'clipboard:addToNotebook',

  // Voice Q&A
  VOICE_START: 'voice:start',
  VOICE_SEND_AUDIO: 'voice:sendAudio',
  VOICE_STOP: 'voice:stop',

  // Global Search
  SEARCH_GLOBAL: 'search:global',

  // DeepBrain Integration
  DEEPBRAIN_STATUS: 'deepbrain:status',
  DEEPBRAIN_RECALL: 'deepbrain:recall',
  DEEPBRAIN_SEARCH: 'deepbrain:search',
  DEEPBRAIN_CLIPBOARD: 'deepbrain:clipboard',
  DEEPBRAIN_REMEMBER: 'deepbrain:remember',
  DEEPBRAIN_THINK: 'deepbrain:think',
  DEEPBRAIN_CONFIGURE: 'deepbrain:configure',

  // System
  SYSTEM_OPEN_FILE: 'system:openFile',

  // DeepBrain (extra)
  DEEPBRAIN_SEARCH_EMAILS: 'deepbrain:searchEmails',
  DEEPBRAIN_ACTIVITY_CURRENT: 'deepbrain:activityCurrent',

  // DeepNote API
  DEEPNOTE_API_STATUS: 'deepnote-api:status',

  // Token Usage
  TOKEN_USAGE_GET_SUMMARY: 'token-usage:get-summary',
  TOKEN_USAGE_RESET: 'token-usage:reset',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface IpcHandlerMap {
  // Notebooks
  [IPC_CHANNELS.NOTEBOOKS_LIST]: { args: []; return: Notebook[] }
  [IPC_CHANNELS.NOTEBOOKS_CREATE]: {
    args: [{ title: string; emoji: string; workspaceRootPath?: string }]
    return: Notebook
  }
  [IPC_CHANNELS.NOTEBOOKS_GET]: { args: [string]; return: Notebook | null }
  [IPC_CHANNELS.NOTEBOOKS_UPDATE]: {
    args: [string, Partial<Pick<Notebook, 'title' | 'emoji' | 'description' | 'chatMode' | 'responseLength' | 'cardBgImage' | 'cardGradientFrom' | 'cardGradientTo'>>]
    return: Notebook
  }
  [IPC_CHANNELS.NOTEBOOKS_DELETE]: { args: [string]; return: void }
  [IPC_CHANNELS.NOTEBOOK_UPLOAD_COVER]: { args: [string, string]; return: string }

  // Sources
  [IPC_CHANNELS.SOURCES_LIST]: { args: [string]; return: Source[] }
  [IPC_CHANNELS.SOURCES_ADD]: {
    args: [{ notebookId: string; type: Source['type']; filePath?: string; content?: string; title?: string; url?: string }]
    return: Source
  }
  [IPC_CHANNELS.SOURCES_DELETE]: { args: [string]; return: void }
  [IPC_CHANNELS.SOURCES_TOGGLE]: { args: [string, boolean]; return: Source }

  // Notes
  [IPC_CHANNELS.NOTES_LIST]: { args: [string]; return: Note[] }
  [IPC_CHANNELS.NOTES_CREATE]: {
    args: [{ notebookId: string; title: string; content: string }]
    return: Note
  }
  [IPC_CHANNELS.NOTES_UPDATE]: {
    args: [string, Partial<Pick<Note, 'title' | 'content' | 'isConvertedToSource'>>]
    return: Note
  }
  [IPC_CHANNELS.NOTES_DELETE]: { args: [string]; return: void }
  [IPC_CHANNELS.NOTES_TAGS]: { args: [string]; return: { tag: string; count: number }[] }
  [IPC_CHANNELS.NOTES_BACKLINKS]: {
    args: [{ notebookId: string; noteTitle: string }]
    return: { id: string; title: string; snippet: string }[]
  }
  [IPC_CHANNELS.NOTES_RESOLVE_LINK]: {
    args: [{ notebookId: string; linkTitle: string }]
    return: { id: string; title: string } | null
  }

  // Canvas
  [IPC_CHANNELS.CANVAS_SAVE]: {
    args: [{ id: string; data: Record<string, unknown> }]
    return: void
  }

  // Chat
  [IPC_CHANNELS.CHAT_MESSAGES]: { args: [string]; return: ChatMessage[] }
  [IPC_CHANNELS.CHAT_SEND]: {
    args: [{ notebookId: string; message: string }]
    return: ChatMessage
  }
  [IPC_CHANNELS.CHAT_SAVE_MESSAGE]: {
    args: [{ notebookId: string; role: 'user' | 'assistant'; content: string }]
    return: ChatMessage
  }
  [IPC_CHANNELS.CHAT_CLEAR]: { args: [string]; return: void }

  // Studio
  [IPC_CHANNELS.STUDIO_GENERATE]: {
    args: [{ notebookId: string; type: GeneratedContent['type']; options?: import('./index').StudioToolOptions }]
    return: GeneratedContent
  }
  [IPC_CHANNELS.STUDIO_STATUS]: { args: [string]; return: GeneratedContent | null }
  [IPC_CHANNELS.STUDIO_LIST]: { args: [string]; return: GeneratedContent[] }
  [IPC_CHANNELS.STUDIO_DELETE]: { args: [string]; return: void }
  [IPC_CHANNELS.STUDIO_RENAME]: { args: [string, string]; return: void }
  [IPC_CHANNELS.STUDIO_SUGGEST_FORMATS]: { args: [string]; return: ReportFormatSuggestion[] }

  // Infographic
  [IPC_CHANNELS.INFOGRAPHIC_START]: {
    args: [{
      notebookId: string
      stylePresetId: string
      aspectRatio: '16:9' | '4:3' | '1:1'
      renderMode?: 'full-image' | 'hybrid'
      userInstructions?: string
      customStyleImagePath?: string
      customStyleColors?: string[]
      customStyleDescription?: string
      imageModel?: ImageModelId
    }]
    return: { generatedContentId: string }
  }

  // White Paper
  [IPC_CHANNELS.WHITEPAPER_START]: {
    args: [{
      notebookId: string
      tone: 'academic' | 'business' | 'technical'
      length: 'concise' | 'standard' | 'comprehensive'
      stylePresetId: string
      userInstructions?: string
      customStyleImagePath?: string
      customStyleColors?: string[]
      customStyleDescription?: string
      imageModel?: ImageModelId
    }]
    return: { generatedContentId: string }
  }
  [IPC_CHANNELS.WHITEPAPER_EXPORT_PDF]: {
    args: [{
      title: string
      subtitle: string
      abstract: string
      date: string
      sections: { number: string; title: string; content: string; imagePath?: string; imageCaption?: string }[]
      references: { number: number; citation: string }[]
      keyFindings: string[]
      conclusion: string
      coverImagePath?: string
      defaultName: string
    }]
    return: { success: boolean; filePath?: string }
  }

  // Notebooks (extra)
  [IPC_CHANNELS.NOTEBOOKS_EXPORT]: {
    args: [{ notebookId: string; format: 'json' | 'html' }]
    return: { success: boolean; filePath: string }
  }

  // Deep Research
  [IPC_CHANNELS.DEEP_RESEARCH_START]: {
    args: [{ notebookId: string; query: string }]
    return: { interactionId: string }
  }

  // Image Slides
  [IPC_CHANNELS.IMAGE_SLIDES_START]: {
    args: [{
      notebookId: string
      stylePresetId: string
      format: 'presentation' | 'pitch' | 'report'
      length: 'test' | 'short' | 'default'
      aspectRatio: '16:9' | '4:3'
      userInstructions?: string
      customStyleImagePath?: string
      renderMode?: SlideRenderMode
      customStyleColors?: string[]
      customStyleDescription?: string
      imageModel?: ImageModelId
    }]
    return: { generatedContentId: string }
  }
  [IPC_CHANNELS.IMAGE_SLIDES_UPDATE_TEXT]: {
    args: [{ generatedContentId: string; slideNumber: number; title: string; bullets: string[]; elements?: SlideTextElement[] }]
    return: void
  }

  // Config
  [IPC_CHANNELS.CONFIG_GET_API_KEY]: { args: []; return: string }
  [IPC_CHANNELS.CONFIG_SET_API_KEY]: { args: [string]; return: void }
  [IPC_CHANNELS.CONFIG_TEST_API_KEY]: { args: [string]; return: { success: boolean; error?: string } }
  [IPC_CHANNELS.CONFIG_GET_CHAT_CONFIG]: {
    args: []
    return: {
      provider: string
      model: string
      hasGeminiKey: boolean
      hasClaudeKey: boolean
      hasOpenaiKey: boolean
      hasGroqKey: boolean
    }
  }
  [IPC_CHANNELS.CONFIG_SET_CHAT_CONFIG]: {
    args: [{ provider?: string; model?: string; geminiKey?: string; claudeKey?: string; openaiKey?: string; groqKey?: string }]
    return: void
  }

  // Save file
  [IPC_CHANNELS.STUDIO_SAVE_FILE]: {
    args: [{ sourcePath: string; defaultName: string }]
    return: { success: boolean; filePath?: string }
  }
  [IPC_CHANNELS.STUDIO_EXPORT_PDF]: {
    args: [{
      imagePaths: string[]
      aspectRatio: '16:9' | '4:3'
      defaultName: string
      textOverlays?: Array<{
        elements: Array<{
          content: string
          x: number
          y: number
          width: number
          fontSize: number
          align: string
          color?: string
          bold?: boolean
        }>
      }>
    }]
    return: { success: boolean; filePath?: string }
  }

  // Dialog
  [IPC_CHANNELS.DIALOG_OPEN_FILE]: {
    args: [{ filters: { name: string; extensions: string[] }[] }]
    return: string | null
  }
  [IPC_CHANNELS.DIALOG_OPEN_DIRECTORY]: {
    args: []
    return: string | null
  }

  // Workspace
  [IPC_CHANNELS.WORKSPACE_LINK]: {
    args: [{ notebookId: string; rootPath: string }]
    return: Notebook
  }
  [IPC_CHANNELS.WORKSPACE_UNLINK]: {
    args: [string]
    return: Notebook
  }
  [IPC_CHANNELS.WORKSPACE_SCAN]: {
    args: [string]
    return: WorkspaceTreeNode
  }
  [IPC_CHANNELS.WORKSPACE_DIFF]: {
    args: [string]
    return: WorkspaceDiffResult
  }
  [IPC_CHANNELS.WORKSPACE_SELECT]: {
    args: [{ notebookId: string; relativePath: string }]
    return: Source
  }
  [IPC_CHANNELS.WORKSPACE_DESELECT]: {
    args: [{ notebookId: string; relativePath: string }]
    return: void
  }
  [IPC_CHANNELS.WORKSPACE_READ]: {
    args: [{ notebookId: string; relativePath: string }]
    return: { content: string; isText: boolean }
  }
  [IPC_CHANNELS.WORKSPACE_WRITE]: {
    args: [{ notebookId: string; relativePath: string; content: string }]
    return: void
  }
  [IPC_CHANNELS.WORKSPACE_CREATE_FILE]: {
    args: [{ notebookId: string; relativePath: string; content?: string }]
    return: void
  }
  [IPC_CHANNELS.WORKSPACE_DELETE_FILE]: {
    args: [{ notebookId: string; relativePath: string }]
    return: void
  }
  [IPC_CHANNELS.WORKSPACE_CREATE_DIR]: {
    args: [{ notebookId: string; relativePath: string }]
    return: void
  }
  [IPC_CHANNELS.WORKSPACE_FILES]: {
    args: [string]
    return: WorkspaceFile[]
  }
  [IPC_CHANNELS.WORKSPACE_SYNC]: {
    args: [string]
    return: { reindexed: number; removed: number }
  }

  // Editor AI
  [IPC_CHANNELS.EDITOR_AI_REWRITE]: {
    args: [{ selectedText: string; instruction: string; fullContent: string; filePath: string }]
    return: { rewrittenText: string }
  }

  // Global Search
  [IPC_CHANNELS.SEARCH_GLOBAL]: {
    args: [{ query: string; notebookIds?: string[]; limit?: number }]
    return: {
      results: {
        notebookId: string
        notebookTitle: string
        sourceId: string
        sourceTitle: string
        text: string
        score: number
        pageNumber?: number
      }[]
      systemResults?: {
        memories: { content: string; memoryType: string; similarity: number }[]
        files: { path: string; name: string; chunk: string; similarity: number; fileType: string }[]
        emails: { subject: string; sender: string; date: string; chunk: string; similarity: number }[]
        spotlight: { path: string; name: string; kind: string }[]
      }
    }
  }

  // Memory
  [IPC_CHANNELS.MEMORY_LIST]: { args: [string | null | undefined]; return: UserMemory[] }
  [IPC_CHANNELS.MEMORY_DELETE]: { args: [string]; return: void }
  [IPC_CHANNELS.MEMORY_CLEAR]: { args: [string | null | undefined]; return: void }

  // Chat-to-Source
  [IPC_CHANNELS.CHAT_GENERATE_FROM_CONTEXT]: {
    args: [{ notebookId: string; content: string; type: string }]
    return: GeneratedContent
  }

  // Source Recommendations
  [IPC_CHANNELS.SOURCES_RECOMMENDATIONS]: {
    args: [{ notebookId: string; sourceId: string; limit?: number }]
    return: SourceRecommendation[]
  }

  // Clipboard
  [IPC_CHANNELS.CLIPBOARD_HISTORY]: { args: []; return: string[] }
  [IPC_CHANNELS.CLIPBOARD_ADD_TO_NOTEBOOK]: {
    args: [{ notebookId: string; text: string; title?: string }]
    return: Source
  }

  // Voice
  [IPC_CHANNELS.VOICE_START]: { args: [{ notebookId: string }]; return: { sessionId: string } }
  [IPC_CHANNELS.VOICE_SEND_AUDIO]: { args: [{ sessionId: string; audioData: string }]; return: void }
  [IPC_CHANNELS.VOICE_STOP]: { args: [{ sessionId: string }]; return: void }

  // DeepBrain
  [IPC_CHANNELS.DEEPBRAIN_STATUS]: {
    args: []
    return: {
      available: boolean
      enabled: boolean
      memoryCount: number
      thoughtCount: number
      aiProvider: string
      aiAvailable: boolean
      embeddingProvider: string
      learningTrend: string
      indexedFiles: number
      indexedChunks: number
      uptimeMs: number
    } | null
  }
  [IPC_CHANNELS.DEEPBRAIN_RECALL]: {
    args: [{ query: string; limit?: number }]
    return: { id: string; content: string; similarity: number; memoryType: string }[]
  }
  [IPC_CHANNELS.DEEPBRAIN_SEARCH]: {
    args: [{ query: string; limit?: number }]
    return: { path: string; name: string; chunk: string; similarity: number; fileType: string }[]
  }
  [IPC_CHANNELS.DEEPBRAIN_CLIPBOARD]: {
    args: [{ limit?: number }?]
    return: { content: string; timestamp: number }[]
  }
  [IPC_CHANNELS.DEEPBRAIN_REMEMBER]: {
    args: [{ content: string; memoryType?: string; importance?: number }]
    return: { id: string; memoryCount: number } | null
  }
  [IPC_CHANNELS.DEEPBRAIN_THINK]: {
    args: [{ input: string }]
    return: { response: string; confidence: number; thoughtId: string; memoryCount: number; aiEnhanced: boolean } | null
  }
  [IPC_CHANNELS.DEEPBRAIN_CONFIGURE]: {
    args: [{ port?: number; token?: string | null; enabled?: boolean }]
    return: void
  }

  // System
  [IPC_CHANNELS.SYSTEM_OPEN_FILE]: {
    args: [{ filePath: string }]
    return: { success: boolean; error?: string }
  }

  // DeepBrain (extra)
  [IPC_CHANNELS.DEEPBRAIN_SEARCH_EMAILS]: {
    args: [{ query: string; limit?: number }]
    return: DeepBrainEmailResult[]
  }
  [IPC_CHANNELS.DEEPBRAIN_ACTIVITY_CURRENT]: {
    args: []
    return: {
      activeApp: string
      windowTitle: string
      project?: string
      idleSeconds: number
      recentFiles: { path: string; timestamp: number }[]
      recentClipboard?: string
    } | null
  }

  // Token Usage
  [IPC_CHANNELS.TOKEN_USAGE_GET_SUMMARY]: { args: []; return: TokenUsageSummary }
  [IPC_CHANNELS.TOKEN_USAGE_RESET]: { args: []; return: void }

  // HTML Presentation
  [IPC_CHANNELS.STUDIO_SAVE_HTML]: {
    args: [{ html: string; defaultName: string }]
    return: { success: boolean; filePath?: string }
  }
  [IPC_CHANNELS.STUDIO_OPEN_HTML_TEMP]: {
    args: [{ html: string; filename: string }]
    return: { success: boolean }
  }

  // HTML Presentation (fire-and-forget)
  [IPC_CHANNELS.HTML_PRESENTATION_START]: {
    args: [{
      notebookId: string
      model: 'flash' | 'pro'
      stylePresetId: string
      userInstructions?: string
      customStyleImagePath?: string
      customStyleColors?: string[]
      customStyleDescription?: string
    }]
    return: { generatedContentId: string }
  }

  // DeepNote API
  [IPC_CHANNELS.DEEPNOTE_API_STATUS]: {
    args: []
    return: { port: number }
  }
}
