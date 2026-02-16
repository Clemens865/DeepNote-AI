/**
 * Local ONNX Embeddings — all-MiniLM-L6-v2 (384 dimensions).
 * Optional feature: requires onnxruntime-node to be installed.
 * Falls back gracefully if not available.
 */

import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'

let ort: typeof import('onnxruntime-node') | null = null
let session: unknown | null = null
let tokenizer: { encode: (text: string) => number[] } | null = null
let available: boolean | null = null

const MODEL_DIR_NAME = 'onnx-embeddings'
const MODEL_FILENAME = 'model.onnx'
const TOKENIZER_FILENAME = 'tokenizer.json'
const EMBEDDING_DIM = 384

function getModelDir(): string {
  const dir = join(app.getPath('userData'), MODEL_DIR_NAME)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Check if ONNX runtime is available (installed).
 */
export function isAvailable(): boolean {
  if (available !== null) return available
  try {
    // Try to require onnxruntime-node
    ort = require('onnxruntime-node')
    available = true
  } catch {
    available = false
  }
  return available
}

/**
 * Check if the model has been downloaded.
 */
export function isModelDownloaded(): boolean {
  const modelDir = getModelDir()
  return (
    existsSync(join(modelDir, MODEL_FILENAME)) &&
    existsSync(join(modelDir, TOKENIZER_FILENAME))
  )
}

/**
 * Download the model from HuggingFace.
 * Returns true on success.
 */
export async function downloadModel(
  onProgress?: (pct: number) => void
): Promise<boolean> {
  const modelDir = getModelDir()

  const baseUrl =
    'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main'

  try {
    // Download ONNX model
    onProgress?.(10)
    const { default: fetch } = await import('node-fetch')

    const modelResp = await fetch(`${baseUrl}/onnx/model.onnx`)
    if (!modelResp.ok) throw new Error(`Model download failed: ${modelResp.status}`)
    const modelBuffer = Buffer.from(await modelResp.arrayBuffer())
    writeFileSync(join(modelDir, MODEL_FILENAME), modelBuffer)
    onProgress?.(60)

    // Download tokenizer
    const tokResp = await fetch(`${baseUrl}/tokenizer.json`)
    if (!tokResp.ok) throw new Error(`Tokenizer download failed: ${tokResp.status}`)
    const tokText = await tokResp.text()
    writeFileSync(join(modelDir, TOKENIZER_FILENAME), tokText)
    onProgress?.(90)

    onProgress?.(100)
    return true
  } catch (err) {
    console.error('[LocalEmbeddings] Download failed:', err)
    return false
  }
}

/**
 * Simple whitespace + subword tokenizer fallback.
 * In production, use the full tokenizer.json with proper BPE.
 */
function simpleTokenize(text: string, maxLength = 128): number[] {
  if (tokenizer) return tokenizer.encode(text).slice(0, maxLength)

  // Load tokenizer.json for vocab lookup
  const modelDir = getModelDir()
  const tokPath = join(modelDir, TOKENIZER_FILENAME)
  if (existsSync(tokPath)) {
    try {
      const tokData = JSON.parse(readFileSync(tokPath, 'utf-8'))
      const vocab: Record<string, number> = tokData.model?.vocab ?? {}

      // Simple word-piece tokenization
      const tokens: number[] = [101] // [CLS]
      const words = text.toLowerCase().split(/\s+/).slice(0, maxLength - 2)
      for (const word of words) {
        const id = vocab[word] ?? vocab[`##${word}`] ?? 100 // [UNK]
        tokens.push(id)
      }
      tokens.push(102) // [SEP]
      return tokens
    } catch {
      // Fallback to hash-based IDs
    }
  }

  // Ultra-simple fallback
  const tokens = [101]
  const words = text.toLowerCase().split(/\s+/).slice(0, maxLength - 2)
  for (const word of words) {
    // Simple hash to integer range
    let hash = 0
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0
    }
    tokens.push(Math.abs(hash) % 30000 + 1000)
  }
  tokens.push(102)
  return tokens
}

/**
 * Initialize ONNX session if not already loaded.
 */
async function ensureSession(): Promise<void> {
  if (session) return
  if (!isAvailable()) throw new Error('ONNX runtime not available')
  if (!isModelDownloaded()) throw new Error('Model not downloaded')

  const modelPath = join(getModelDir(), MODEL_FILENAME)
  const InferenceSession = (ort as typeof import('onnxruntime-node')).InferenceSession
  session = await InferenceSession.create(modelPath)
}

/**
 * Generate embeddings for a batch of texts using the local ONNX model.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  await ensureSession()
  if (!ort || !session) throw new Error('ONNX session not initialized')

  const Tensor = ort.Tensor
  const results: number[][] = []

  for (const text of texts) {
    const tokenIds = simpleTokenize(text)
    const attentionMask = tokenIds.map(() => 1)
    const tokenTypeIds = tokenIds.map(() => 0)

    const inputIds = new Tensor('int64', BigInt64Array.from(tokenIds.map(BigInt)), [
      1,
      tokenIds.length,
    ])
    const attnMask = new Tensor(
      'int64',
      BigInt64Array.from(attentionMask.map(BigInt)),
      [1, tokenIds.length]
    )
    const tokenTypes = new Tensor(
      'int64',
      BigInt64Array.from(tokenTypeIds.map(BigInt)),
      [1, tokenIds.length]
    )

    const feeds = {
      input_ids: inputIds,
      attention_mask: attnMask,
      token_type_ids: tokenTypes,
    }

    const output = await (session as { run: (feeds: unknown) => Promise<Record<string, { data: Float32Array }>> }).run(feeds)
    const embeddings = output['last_hidden_state'] || output[Object.keys(output)[0]]

    // Mean pooling over token dimension
    const data = embeddings.data as Float32Array
    const seqLen = tokenIds.length
    const vec = new Array(EMBEDDING_DIM).fill(0)
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        vec[j] += data[i * EMBEDDING_DIM + j]
      }
    }
    for (let j = 0; j < EMBEDDING_DIM; j++) {
      vec[j] /= seqLen
    }

    // L2 normalize
    const norm = Math.sqrt(vec.reduce((sum: number, v: number) => sum + v * v, 0))
    if (norm > 0) {
      for (let j = 0; j < EMBEDDING_DIM; j++) vec[j] /= norm
    }

    results.push(vec)
  }

  return results
}

/**
 * Embed a single query text.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const vecs = await embed([text])
  return vecs[0] ?? new Array(EMBEDDING_DIM).fill(0)
}
