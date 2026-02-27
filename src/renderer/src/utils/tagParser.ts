/**
 * Extract #tags from note content.
 * Avoids false positives on hex colors (#fff, #FF00AA) and markdown headings (# Title).
 */
export function extractTags(content: string): string[] {
  const matches = content.match(/#[a-zA-Z][a-zA-Z0-9_-]*/g)
  if (!matches) return []
  const unique = new Set(matches.map((t) => t.toLowerCase()))
  return Array.from(unique)
}
