import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

interface AppConfig {
  apiKey: string
  embeddingsModel: 'auto' | 'gemini' | 'local'
}

const defaultConfig: AppConfig = {
  apiKey: '',
  embeddingsModel: 'auto',
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

  getConfig(): AppConfig {
    return readConfig()
  }

  setConfig(partial: Partial<AppConfig>): void {
    const config = readConfig()
    Object.assign(config, partial)
    writeConfig(config)
  }
}

export const configService = new ConfigService()
