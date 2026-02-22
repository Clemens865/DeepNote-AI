/**
 * Sanitizes Mermaid diagram code to fix common AI-generated syntax errors.
 * Returns the sanitized code string.
 */
export function sanitizeMermaidCode(code: string): string {
  let result = code

  // Normalize literal \n to actual newlines
  result = result.replace(/\\n/g, '\n')

  // Remove trailing semicolons on lines
  result = result.replace(/;\s*$/gm, '')

  // Fix ---> to -->
  result = result.replace(/--->/g, '-->')

  // Add missing graph direction: "graph\n" → "graph TD\n"
  result = result.replace(/^(graph)\s*$/m, '$1 TD')

  // Split into lines for per-line processing
  const lines = result.split('\n')
  const processed = lines.map((line) => {
    // Skip lines that are diagram type declarations or comments
    if (/^\s*(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|gantt|pie|stateDiagram|journey)\b/.test(line)) {
      return line
    }
    if (/^\s*%%/.test(line)) return line

    // Quote unquoted labels in square brackets that contain special chars
    // Match A[label] but not A["label"] or A["label"]
    line = line.replace(
      /(\w+)\[([^\]"]+)\]/g,
      (_match, id: string, label: string) => {
        if (/[():<>&]/.test(label)) {
          // Escape any quotes inside the label
          const escaped = label.replace(/"/g, '#quot;')
          return `${id}["${escaped}"]`
        }
        return `${id}["${label}"]`
      }
    )

    // Quote unquoted labels in curly braces (decision nodes) that contain special chars
    line = line.replace(
      /(\w+)\{([^}"]+)\}/g,
      (_match, id: string, label: string) => {
        if (/[():<>&]/.test(label)) {
          const escaped = label.replace(/"/g, '#quot;')
          return `${id}{"${escaped}"}`
        }
        return `${id}{"${label}"}`
      }
    )

    return line
  })

  result = processed.join('\n')

  // Collapse excessive blank lines (3+ → 1)
  result = result.replace(/\n{3,}/g, '\n\n')

  return result.trim()
}
