import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../shared/types/ipc'

const api = {
  // Notebooks
  listNotebooks: () => ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOKS_LIST),
  createNotebook: (args: { title: string; emoji: string; workspaceRootPath?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOKS_CREATE, args),
  getNotebook: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOKS_GET, id),
  updateNotebook: (id: string, data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOKS_UPDATE, id, data),
  deleteNotebook: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOKS_DELETE, id),
  uploadNotebookCover: (notebookId: string, base64: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOK_UPLOAD_COVER, notebookId, base64),
  exportNotebook: (args: { notebookId: string; format: 'json' | 'html' }) =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOKS_EXPORT, args),

  // Sources
  listSources: (notebookId: string) => ipcRenderer.invoke(IPC_CHANNELS.SOURCES_LIST, notebookId),
  addSource: (args: {
    notebookId: string
    type: string
    filePath?: string
    content?: string
    title?: string
    url?: string
  }) => ipcRenderer.invoke(IPC_CHANNELS.SOURCES_ADD, args),
  deleteSource: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SOURCES_DELETE, id),
  toggleSource: (id: string, isSelected: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.SOURCES_TOGGLE, id, isSelected),

  // Notes
  listNotes: (notebookId: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_LIST, notebookId),
  createNote: (args: { notebookId: string; title: string; content: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTES_CREATE, args),
  updateNote: (id: string, data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTES_UPDATE, id, data),
  deleteNote: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_DELETE, id),

  // Chat
  chatMessages: (notebookId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHAT_MESSAGES, notebookId),
  chatSend: (args: { notebookId: string; message: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, args),
  chatSaveMessage: (args: { notebookId: string; role: 'user' | 'assistant'; content: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHAT_SAVE_MESSAGE, args),
  chatClear: (notebookId: string) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_CLEAR, notebookId),

  // Studio
  studioGenerate: (args: { notebookId: string; type: string; options?: Record<string, unknown> }) =>
    ipcRenderer.invoke(IPC_CHANNELS.STUDIO_GENERATE, args),
  studioSaveFile: (args: { sourcePath: string; defaultName: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.STUDIO_SAVE_FILE, args),
  studioExportPdf: (args: { imagePaths: string[]; aspectRatio: '16:9' | '4:3'; defaultName: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.STUDIO_EXPORT_PDF, args),
  studioStatus: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.STUDIO_STATUS, id),
  studioList: (notebookId: string) => ipcRenderer.invoke(IPC_CHANNELS.STUDIO_LIST, notebookId),
  studioDelete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.STUDIO_DELETE, id),
  studioRename: (id: string, title: string) => ipcRenderer.invoke(IPC_CHANNELS.STUDIO_RENAME, id, title),
  studioSuggestFormats: (notebookId: string) => ipcRenderer.invoke(IPC_CHANNELS.STUDIO_SUGGEST_FORMATS, notebookId),

  // Infographic
  infographicStart: (args: {
    notebookId: string
    stylePresetId: string
    aspectRatio: '16:9' | '4:3' | '1:1'
    renderMode?: 'full-image' | 'hybrid'
    userInstructions?: string
    customStyleImagePath?: string
    customStyleColors?: string[]
    customStyleDescription?: string
  }) => ipcRenderer.invoke(IPC_CHANNELS.INFOGRAPHIC_START, args),
  onInfographicProgress: (
    callback: (data: { generatedContentId: string; stage: string; message: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { generatedContentId: string; stage: string; message: string }
    ) => callback(data)
    ipcRenderer.on('infographic:progress', handler)
    return () => {
      ipcRenderer.removeListener('infographic:progress', handler)
    }
  },
  onInfographicComplete: (
    callback: (data: { generatedContentId: string; success: boolean; error?: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { generatedContentId: string; success: boolean; error?: string }
    ) => callback(data)
    ipcRenderer.on('infographic:complete', handler)
    return () => {
      ipcRenderer.removeListener('infographic:complete', handler)
    }
  },

  // White Paper
  whitepaperStart: (args: {
    notebookId: string
    tone: 'academic' | 'business' | 'technical'
    length: 'concise' | 'standard' | 'comprehensive'
    stylePresetId: string
    userInstructions?: string
    customStyleImagePath?: string
    customStyleColors?: string[]
    customStyleDescription?: string
  }) => ipcRenderer.invoke(IPC_CHANNELS.WHITEPAPER_START, args),
  onWhitepaperProgress: (
    callback: (data: { generatedContentId: string; stage: string; currentSection?: number; totalSections?: number; message: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { generatedContentId: string; stage: string; currentSection?: number; totalSections?: number; message: string }
    ) => callback(data)
    ipcRenderer.on('whitepaper:progress', handler)
    return () => {
      ipcRenderer.removeListener('whitepaper:progress', handler)
    }
  },
  whitepaperExportPdf: (args: {
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
  }) => ipcRenderer.invoke(IPC_CHANNELS.WHITEPAPER_EXPORT_PDF, args),
  onWhitepaperComplete: (
    callback: (data: { generatedContentId: string; success: boolean; error?: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { generatedContentId: string; success: boolean; error?: string }
    ) => callback(data)
    ipcRenderer.on('whitepaper:complete', handler)
    return () => {
      ipcRenderer.removeListener('whitepaper:complete', handler)
    }
  },

  // Config
  getApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_API_KEY),
  setApiKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_API_KEY, key),
  testApiKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_TEST_API_KEY, key),
  getChatConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_CHAT_CONFIG),
  setChatConfig: (args: { provider?: string; model?: string; geminiKey?: string; claudeKey?: string; openaiKey?: string; groqKey?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_CHAT_CONFIG, args),

  // Streaming
  onChatStreamChunk: (callback: (data: { messageId: string; chunk: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { messageId: string; chunk: string }) => callback(data)
    ipcRenderer.on('chat:stream-chunk', handler)
    return () => {
      ipcRenderer.removeListener('chat:stream-chunk', handler)
    }
  },

  // Deep Research
  deepResearchStart: (args: { notebookId: string; query: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEEP_RESEARCH_START, args),
  onDeepResearchProgress: (callback: (data: { status: string; thinking?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { status: string; thinking?: string }) => callback(data)
    ipcRenderer.on('deep-research:progress', handler)
    return () => {
      ipcRenderer.removeListener('deep-research:progress', handler)
    }
  },
  onDeepResearchComplete: (callback: (data: { success: boolean; error?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { success: boolean; error?: string }) => callback(data)
    ipcRenderer.on('deep-research:complete', handler)
    return () => {
      ipcRenderer.removeListener('deep-research:complete', handler)
    }
  },

  // Image Slides
  imageSlidesStart: (args: {
    notebookId: string
    stylePresetId: string
    format: 'presentation' | 'pitch' | 'report'
    length: 'test' | 'short' | 'default'
    aspectRatio: '16:9' | '4:3'
    userInstructions?: string
    customStyleImagePath?: string
    renderMode?: 'full-image' | 'hybrid'
    customStyleColors?: string[]
    customStyleDescription?: string
  }) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_SLIDES_START, args),
  imageSlidesUpdateText: (args: {
    generatedContentId: string
    slideNumber: number
    title: string
    bullets: string[]
    elements?: { id: string; type: string; content: string; x: number; y: number; width: number; style: Record<string, unknown> }[]
  }) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_SLIDES_UPDATE_TEXT, args),
  onImageSlidesProgress: (
    callback: (data: {
      generatedContentId: string
      stage: string
      currentSlide?: number
      totalSlides?: number
      message: string
    }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: {
        generatedContentId: string
        stage: string
        currentSlide?: number
        totalSlides?: number
        message: string
      }
    ) => callback(data)
    ipcRenderer.on('image-slides:progress', handler)
    return () => {
      ipcRenderer.removeListener('image-slides:progress', handler)
    }
  },
  onImageSlidesComplete: (
    callback: (data: { generatedContentId: string; success: boolean; error?: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { generatedContentId: string; success: boolean; error?: string }
    ) => callback(data)
    ipcRenderer.on('image-slides:complete', handler)
    return () => {
      ipcRenderer.removeListener('image-slides:complete', handler)
    }
  },

  // Dialog
  showOpenDialog: (args: { filters: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, args),
  openDirectoryDialog: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY),

  // Workspace
  workspaceLink: (args: { notebookId: string; rootPath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LINK, args),
  workspaceUnlink: (notebookId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UNLINK, notebookId),
  workspaceScan: (notebookId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SCAN, notebookId),
  workspaceDiff: (notebookId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DIFF, notebookId),
  workspaceSelect: (args: { notebookId: string; relativePath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SELECT, args),
  workspaceDeselect: (args: { notebookId: string; relativePath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DESELECT, args),
  workspaceRead: (args: { notebookId: string; relativePath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_READ, args),
  workspaceWrite: (args: { notebookId: string; relativePath: string; content: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_WRITE, args),
  workspaceCreateFile: (args: { notebookId: string; relativePath: string; content?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CREATE_FILE, args),
  workspaceDeleteFile: (args: { notebookId: string; relativePath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE_FILE, args),
  workspaceCreateDir: (args: { notebookId: string; relativePath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CREATE_DIR, args),
  workspaceFiles: (notebookId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_FILES, notebookId),
  workspaceSync: (notebookId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SYNC, notebookId),

  // Editor AI
  editorAiRewrite: (args: { selectedText: string; instruction: string; fullContent: string; filePath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.EDITOR_AI_REWRITE, args),

  // Memory
  memoryList: (notebookId?: string | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEMORY_LIST, notebookId),
  memoryDelete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.MEMORY_DELETE, id),
  memoryClear: (notebookId?: string | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEMORY_CLEAR, notebookId),

  // Studio generation progress (pipeline)
  onStudioGenerationProgress: (
    callback: (data: { generatedContentId: string; stage: string; message: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { generatedContentId: string; stage: string; message: string }
    ) => callback(data)
    ipcRenderer.on('studio:generation-progress', handler)
    return () => {
      ipcRenderer.removeListener('studio:generation-progress', handler)
    }
  },

  // Chat-to-Source
  chatGenerateFromContext: (args: { notebookId: string; content: string; type: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHAT_GENERATE_FROM_CONTEXT, args),

  // Source Recommendations
  sourceRecommendations: (args: { notebookId: string; sourceId: string; limit?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SOURCES_RECOMMENDATIONS, args),

  // Clipboard Quick-Capture
  clipboardHistory: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_HISTORY),
  clipboardAddToNotebook: (args: { notebookId: string; text: string; title?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_ADD_TO_NOTEBOOK, args),
  onClipboardCaptured: (callback: (data: { text: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { text: string }) => callback(data)
    ipcRenderer.on('clipboard:captured', handler)
    return () => {
      ipcRenderer.removeListener('clipboard:captured', handler)
    }
  },
  onClipboardAddToNotebook: (callback: (data: { notebookId: string; text: string; title: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { notebookId: string; text: string; title: string }) => callback(data)
    ipcRenderer.on('clipboard:add-to-notebook', handler)
    return () => {
      ipcRenderer.removeListener('clipboard:add-to-notebook', handler)
    }
  },

  // Voice Q&A (Live API)
  voiceStart: (args: { notebookId: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.VOICE_START, args),
  voiceSendAudio: (args: { sessionId: string; audioData: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.VOICE_SEND_AUDIO, args),
  voiceStop: (args: { sessionId: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.VOICE_STOP, args),
  onVoiceResponseText: (callback: (data: { sessionId: string; text: string; type: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; text: string; type: string }) => callback(data)
    ipcRenderer.on('voice:response-text', handler)
    return () => {
      ipcRenderer.removeListener('voice:response-text', handler)
    }
  },
  onVoiceResponseAudio: (callback: (data: { sessionId: string; audioData: string; mimeType: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; audioData: string; mimeType: string }) => callback(data)
    ipcRenderer.on('voice:response-audio', handler)
    return () => {
      ipcRenderer.removeListener('voice:response-audio', handler)
    }
  },
  onVoiceTurnComplete: (callback: (data: { sessionId: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string }) => callback(data)
    ipcRenderer.on('voice:turn-complete', handler)
    return () => {
      ipcRenderer.removeListener('voice:turn-complete', handler)
    }
  },
  onVoiceInterrupted: (callback: (data: { sessionId: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string }) => callback(data)
    ipcRenderer.on('voice:interrupted', handler)
    return () => {
      ipcRenderer.removeListener('voice:interrupted', handler)
    }
  },

  // Global Search
  globalSearch: (args: { query: string; notebookIds?: string[]; limit?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_GLOBAL, args),

  // DeepBrain Integration
  deepbrainStatus: () => ipcRenderer.invoke(IPC_CHANNELS.DEEPBRAIN_STATUS),
  deepbrainRecall: (args: { query: string; limit?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEEPBRAIN_RECALL, args),
  deepbrainSearch: (args: { query: string; limit?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEEPBRAIN_SEARCH, args),
  deepbrainClipboard: (args?: { limit?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEEPBRAIN_CLIPBOARD, args),
  deepbrainRemember: (args: { content: string; memoryType?: string; importance?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEEPBRAIN_REMEMBER, args),
  deepbrainThink: (args: { input: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEEPBRAIN_THINK, args),
  deepbrainConfigure: (args: { port?: number; token?: string | null; enabled?: boolean }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEEPBRAIN_CONFIGURE, args),

  // System
  systemOpenFile: (args: { filePath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_FILE, args),

  // DeepBrain (extra)
  deepbrainSearchEmails: (args: { query: string; limit?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEEPBRAIN_SEARCH_EMAILS, args),
  deepbrainActivityCurrent: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DEEPBRAIN_ACTIVITY_CURRENT),

  // DeepNote API
  deepnoteApiStatus: () => ipcRenderer.invoke(IPC_CHANNELS.DEEPNOTE_API_STATUS),

  // Workspace auto-sync events
  onWorkspaceAutoSync: (
    callback: (data: { notebookId: string; status: string; message: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { notebookId: string; status: string; message: string }
    ) => callback(data)
    ipcRenderer.on('workspace:auto-sync', handler)
    return () => {
      ipcRenderer.removeListener('workspace:auto-sync', handler)
    }
  },
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
