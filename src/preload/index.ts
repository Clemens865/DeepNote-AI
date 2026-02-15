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
  chatClear: (notebookId: string) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_CLEAR, notebookId),

  // Studio
  studioGenerate: (args: { notebookId: string; type: string; options?: Record<string, unknown> }) =>
    ipcRenderer.invoke(IPC_CHANNELS.STUDIO_GENERATE, args),
  studioSaveFile: (args: { sourcePath: string; defaultName: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.STUDIO_SAVE_FILE, args),
  studioStatus: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.STUDIO_STATUS, id),
  studioList: (notebookId: string) => ipcRenderer.invoke(IPC_CHANNELS.STUDIO_LIST, notebookId),
  studioDelete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.STUDIO_DELETE, id),
  studioRename: (id: string, title: string) => ipcRenderer.invoke(IPC_CHANNELS.STUDIO_RENAME, id, title),

  // Config
  getApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_API_KEY),
  setApiKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_API_KEY, key),
  testApiKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_TEST_API_KEY, key),

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
