/**
 * Ollama Embeddings — calls local Ollama API for embedding generation.
 * Uses nomic-embed-text by default (768-dim, fast, high quality).
 */

const OLLAMA_BASE = 'http://localhost:11434'
const DEFAULT_MODEL = 'nomic-embed-text'

/**
 * Check if Ollama is running and the embedding model is available.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const resp = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) })
    if (!resp.ok) return false
    const data = (await resp.json()) as { models?: { name: string }[] }
    return data.models?.some((m) => m.name.startsWith(DEFAULT_MODEL)) ?? false
  } catch {
    return false
  }
}

/**
 * Embed a batch of texts using Ollama.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  const resp = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: DEFAULT_MODEL, input: texts }),
    signal: AbortSignal.timeout(30000),
  })

  if (!resp.ok) {
    throw new Error(`Ollama embed failed: ${resp.status} ${resp.statusText}`)
  }

  const data = (await resp.json()) as { embeddings: number[][] }
  return data.embeddings
}

/**
 * Embed a single query text.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const vecs = await embed([text])
  return vecs[0]
}
