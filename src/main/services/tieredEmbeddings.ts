/**
 * Tiered Embeddings — ONNX (local) → Gemini API → hash fallback.
 * Respects the config setting: 'auto' | 'gemini' | 'local'.
 */

import { configService } from './config'
import { embeddingsService } from './embeddings'
import * as localEmbeddings from './localEmbeddings'

/**
 * Hash-based fallback embeddings.
 * Produces a deterministic 768-dim vector from text.
 * Quality is poor but prevents total failure.
 */
function hashEmbed(text: string, dim = 768): number[] {
  const vec = new Array(dim).fill(0)
  for (let i = 0; i < text.length; i++) {
    const idx = i % dim
    vec[idx] += text.charCodeAt(i) / 256
  }
  // Normalize
  const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0))
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm
  }
  return vec
}

/**
 * Embed texts using the tiered approach.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  const mode = configService.getEmbeddingsModel?.() ?? 'auto'

  // Forced local
  if (mode === 'local') {
    if (localEmbeddings.isAvailable() && localEmbeddings.isModelDownloaded()) {
      return localEmbeddings.embed(texts)
    }
    console.warn('[TieredEmbeddings] Local mode requested but not available, falling back')
  }

  // Forced gemini
  if (mode === 'gemini') {
    try {
      return await embeddingsService.embed(texts)
    } catch (err) {
      console.warn('[TieredEmbeddings] Gemini failed:', err)
      return texts.map((t) => hashEmbed(t))
    }
  }

  // Auto mode: try local → gemini → hash
  if (localEmbeddings.isAvailable() && localEmbeddings.isModelDownloaded()) {
    try {
      return await localEmbeddings.embed(texts)
    } catch (err) {
      console.warn('[TieredEmbeddings] Local ONNX failed, trying Gemini:', err)
    }
  }

  try {
    return await embeddingsService.embed(texts)
  } catch (err) {
    console.warn('[TieredEmbeddings] Gemini failed, using hash fallback:', err)
    return texts.map((t) => hashEmbed(t))
  }
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
export function getActiveModel(): 'local' | 'gemini' | 'hash' {
  const mode = configService.getEmbeddingsModel?.() ?? 'auto'

  if (mode === 'local' && localEmbeddings.isAvailable() && localEmbeddings.isModelDownloaded()) {
    return 'local'
  }
  if (mode === 'gemini') return 'gemini'
  if (mode === 'auto') {
    if (localEmbeddings.isAvailable() && localEmbeddings.isModelDownloaded()) return 'local'
    return 'gemini'
  }
  return 'gemini'
}
