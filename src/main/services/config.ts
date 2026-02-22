import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

import type { ChatProviderType } from '../../shared/providers'

interface AppConfig {
  apiKey: string
  claudeApiKey: string
  openaiApiKey: string
  groqApiKey: string
  chatProvider: ChatProviderType
  chatModel: string
  embeddingsModel: 'auto' | 'gemini' | 'local'
  deepbrainPort: number
  deepbrainToken: string
  deepbrainEnabled: boolean
  deepnoteApiPort: number
  deepnoteApiToken: string
}

const defaultConfig: AppConfig = {
  apiKey: '',
  claudeApiKey: '',
  openaiApiKey: '',
  groqApiKey: '',
  chatProvider: 'gemini',
  chatModel: 'gemini-3-flash-preview',
  embeddingsModel: 'auto',
  deepbrainPort: 19519,
  deepbrainToken: '',
  deepbrainEnabled: true,
  deepnoteApiPort: 19520,
  deepnoteApiToken: '',
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function readConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return { ...defaultConfig }
  try {
    const raw = readFileSync(configPath, 'utf-8')
    return { ...defaultConfig, ...JSON.parse(raw) }
  } catch {
    return { ...defaultConfig }
  }
}

function writeConfig(config: AppConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

export class ConfigService {
  getApiKey(): string {
    return readConfig().apiKey
  }

  setApiKey(key: string): void {
    const config = readConfig()
    config.apiKey = key.trim()
    writeConfig(config)
  }

  getEmbeddingsModel(): 'auto' | 'gemini' | 'local' {
    return readConfig().embeddingsModel || 'auto'
  }

  setEmbeddingsModel(model: 'auto' | 'gemini' | 'local'): void {
    const config = readConfig()
    config.embeddingsModel = model
    writeConfig(config)
  }

  getAll(): AppConfig {
    return readConfig()
  }

  setConfig(partial: Partial<AppConfig>): void {
    const config = readConfig()
    Object.assign(config, partial)
    writeConfig(config)
  }
}

export const configService = new ConfigService()
