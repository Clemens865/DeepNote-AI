import type { Notebook, Source, Note, ChatMessage, GeneratedContent, WorkspaceFile, WorkspaceTreeNode, WorkspaceDiffResult, SlideRenderMode, SlideTextElement, ReportFormatSuggestion } from './index'

export const IPC_CHANNELS = {
  // Notebooks
  NOTEBOOKS_LIST: 'notebooks:list',
  NOTEBOOKS_CREATE: 'notebooks:create',
  NOTEBOOKS_GET: 'notebooks:get',
  NOTEBOOKS_UPDATE: 'notebooks:update',
  NOTEBOOKS_DELETE: 'notebooks:delete',

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

  // Config
  CONFIG_GET_API_KEY: 'config:getApiKey',
  CONFIG_SET_API_KEY: 'config:setApiKey',
  CONFIG_TEST_API_KEY: 'config:testApiKey',

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

  // Global Search
  SEARCH_GLOBAL: 'search:global',
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
    args: [string, Partial<Pick<Notebook, 'title' | 'emoji' | 'description' | 'chatMode' | 'responseLength'>>]
    return: Notebook
  }
  [IPC_CHANNELS.NOTEBOOKS_DELETE]: { args: [string]; return: void }

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

  // Chat
  [IPC_CHANNELS.CHAT_MESSAGES]: { args: [string]; return: ChatMessage[] }
  [IPC_CHANNELS.CHAT_SEND]: {
    args: [{ notebookId: string; message: string }]
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
      userInstructions?: string
      customStyleImagePath?: string
      customStyleColors?: string[]
      customStyleDescription?: string
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
    }]
    return: { generatedContentId: string }
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

  // Save file
  [IPC_CHANNELS.STUDIO_SAVE_FILE]: {
    args: [{ sourcePath: string; defaultName: string }]
    return: { success: boolean; filePath?: string }
  }
  [IPC_CHANNELS.STUDIO_EXPORT_PDF]: {
    args: [{ imagePaths: string[]; aspectRatio: '16:9' | '4:3'; defaultName: string }]
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
    }
  }
}
