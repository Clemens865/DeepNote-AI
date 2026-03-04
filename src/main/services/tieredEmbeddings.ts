/**
 * Tiered Embeddings — Ollama (local) → ONNX (local) → hash fallback.
 * Default is 'local': tries Ollama first (nomic-embed-text), then ONNX, then hash.
 */

import { configService } from './config'
import { embeddingsService } from './embeddings'
import * as localEmbeddings from './localEmbeddings'
import * as ollamaEmbeddings from './ollamaEmbeddings'

/** Cache Ollama availability to avoid repeated health checks. */
let ollamaAvailable: boolean | null = null
let ollamaCheckedAt = 0
const OLLAMA_CHECK_INTERVAL = 60_000 // recheck every 60s

async function checkOllama(): Promise<boolean> {
  const now = Date.now()
  if (ollamaAvailable !== null && now - ollamaCheckedAt < OLLAMA_CHECK_INTERVAL) {
    return ollamaAvailable
  }
  ollamaAvailable = await ollamaEmbeddings.isAvailable()
  ollamaCheckedAt = now
  return ollamaAvailable
}

/**
 * Hash-based fallback embeddings.
 * Produces a deterministic vector from text.
 * Quality is poor but prevents total failure.
 */
function hashEmbed(text: string, dim = 768): number[] {
  const vec = new Array(dim).fill(0)
  for (let i = 0; i < text.length; i++) {
    const idx = i % dim
    vec[idx] += text.charCodeAt(i) / 256
  }
  const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0))
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm
  }
  return vec
}

/**
 * Embed texts using the configured approach.
 * Default: Ollama → ONNX → hash fallback.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  const mode = configService.getEmbeddingsModel?.() ?? 'local'

  // Forced gemini (user explicitly chose it)
  if (mode === 'gemini') {
    try {
      return await embeddingsService.embed(texts)
    } catch (err) {
      console.warn('[TieredEmbeddings] Gemini failed:', err)
      return texts.map((t) => hashEmbed(t))
    }
  }

  // Local: try Ollama → ONNX → hash
  if (await checkOllama()) {
    try {
      return await ollamaEmbeddings.embed(texts)
    } catch (err) {
      console.warn('[TieredEmbeddings] Ollama failed:', err)
      // Invalidate cache so we recheck next time
      ollamaAvailable = null
    }
  }

  if (localEmbeddings.isAvailable() && localEmbeddings.isModelDownloaded()) {
    try {
      return await localEmbeddings.embed(texts)
    } catch (err) {
      console.warn('[TieredEmbeddings] Local ONNX failed:', err)
    }
  }

  return texts.map((t) => hashEmbed(t))
}

/**
 * Embed a single query text.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const vecs = await embed([text])
  return vecs[0] ?? hashEmbed(text)
}

/**
 * Get info about what embedding model is currently active.
 */
export async function getActiveModel(): Promise<'ollama' | 'local' | 'gemini' | 'hash'> {
  const mode = configService.getEmbeddingsModel?.() ?? 'local'
  if (mode === 'gemini') return 'gemini'
  if (await checkOllama()) return 'ollama'
  if (localEmbeddings.isAvailable() && localEmbeddings.isModelDownloaded()) return 'local'
  return 'hash'
}
