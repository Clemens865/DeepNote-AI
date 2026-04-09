import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq, and, lte, gte } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import type { TasksListFilter } from '../../shared/types'
import { getDatabase, schema } from '../db'

/** Strip HTML tags to extract plain text */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

/** Extract due date from task text (due:YYYY-MM-DD) */
function extractDueDate(text: string): string | null {
  const match = text.match(/due:(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/** Extract priority from task text (!high, !medium, !low) */
function extractPriority(text: string): 'low' | 'medium' | 'high' | null {
  if (/!high\b/i.test(text)) return 'high'
  if (/!medium\b/i.test(text)) return 'medium'
  if (/!low\b/i.test(text)) return 'low'
  return null
}

/** Clean metadata markers from display text */
function cleanTaskText(text: string): string {
  return text
    .replace(/due:\d{4}-\d{2}-\d{2}/g, '')
    .replace(/!(high|medium|low)\b/gi, '')
    .trim()
}

interface ParsedTask {
  text: string
  isCompleted: boolean
  dueDate: string | null
  priority: 'low' | 'medium' | 'high' | null
  lineIndex: number
}

/** Parse note HTML content for task checkboxes */
function parseTasksFromContent(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = []
  // Match both HTML checkbox patterns and markdown-style patterns
  // TipTap task lists use <li data-checked="true|false"> or <input type="checkbox">
  // Also match raw markdown: - [ ] and - [x]

  // Split content by lines for lineIndex tracking
  const lines = content.split(/\n|<br\s*\/?>|<\/p>|<\/li>/)
  let lineIndex = 0

  for (const line of lines) {
    const stripped = stripHtml(line)

    // Check for markdown-style tasks: - [ ] or - [x] or * [ ] or * [x]
    const mdMatch = stripped.match(/^[-*]\s*\[([ xX])\]\s*(.+)/)
    if (mdMatch) {
      const isCompleted = mdMatch[1].toLowerCase() === 'x'
      const rawText = mdMatch[2]
      const dueDate = extractDueDate(rawText)
      const priority = extractPriority(rawText)
      const text = cleanTaskText(rawText)
      if (text) {
        tasks.push({ text, isCompleted, dueDate, priority, lineIndex })
      }
      lineIndex++
      continue
    }

    // Check for HTML task list items: data-checked attribute
    const htmlCheckedMatch = line.match(/data-checked="(true|false)"/)
    if (htmlCheckedMatch) {
      const isCompleted = htmlCheckedMatch[1] === 'true'
      const rawText = stripped
      const dueDate = extractDueDate(rawText)
      const priority = extractPriority(rawText)
      const text = cleanTaskText(rawText)
      if (text) {
        tasks.push({ text, isCompleted, dueDate, priority, lineIndex })
      }
      lineIndex++
      continue
    }

    // Check for checkbox input patterns
    const checkboxMatch = line.match(/<input[^>]*type="checkbox"[^>]*>/)
    if (checkboxMatch) {
      const isCompleted = /checked/.test(checkboxMatch[0])
      const rawText = stripped
      const dueDate = extractDueDate(rawText)
      const priority = extractPriority(rawText)
      const text = cleanTaskText(rawText)
      if (text) {
        tasks.push({ text, isCompleted, dueDate, priority, lineIndex })
      }
    }

    lineIndex++
  }

  return tasks
}

/** Sync tasks extracted from note content to the database */
export async function syncTasksFromContent(
  noteId: string,
  notebookId: string,
  content: string
): Promise<void> {
  const db = getDatabase()
  const now = new Date().toISOString()
  const parsed = parseTasksFromContent(content)

  // Get existing tasks for this note
  const existing = await db
    .select()
    .from(schema.noteTasks)
    .where(eq(schema.noteTasks.noteId, noteId))

  const existingByLine = new Map(existing.map((t) => [t.lineIndex, t]))
  const parsedLineIndices = new Set(parsed.map((t) => t.lineIndex))

  for (const task of parsed) {
    const existingTask = existingByLine.get(task.lineIndex)
    if (existingTask) {
      // Update if changed
      if (
        existingTask.text !== task.text ||
        existingTask.isCompleted !== task.isCompleted ||
        existingTask.dueDate !== task.dueDate ||
        existingTask.priority !== task.priority
      ) {
        await db
          .update(schema.noteTasks)
          .set({
            text: task.text,
            isCompleted: task.isCompleted,
            dueDate: task.dueDate,
            priority: task.priority,
            updatedAt: now,
          })
          .where(eq(schema.noteTasks.id, existingTask.id))
      }
    } else {
      // Create new task
      await db.insert(schema.noteTasks).values({
        id: randomUUID(),
        notebookId,
        noteId,
        text: task.text,
        isCompleted: task.isCompleted,
        dueDate: task.dueDate,
        priority: task.priority,
        lineIndex: task.lineIndex,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // Delete tasks that no longer exist in the content
  for (const [lineIdx, task] of existingByLine) {
    if (!parsedLineIndices.has(lineIdx)) {
      await db.delete(schema.noteTasks).where(eq(schema.noteTasks.id, task.id))
    }
  }
}

export function registerTaskHandlers() {
  // List tasks with optional filters
  ipcMain.handle(IPC_CHANNELS.TASKS_LIST, async (_event, filter: TasksListFilter) => {
    const db = getDatabase()

    const conditions = [eq(schema.noteTasks.notebookId, filter.notebookId)]

    if (filter.completed !== undefined) {
      conditions.push(eq(schema.noteTasks.isCompleted, filter.completed))
    }
    if (filter.noteId) {
      conditions.push(eq(schema.noteTasks.noteId, filter.noteId))
    }
    if (filter.priority) {
      conditions.push(eq(schema.noteTasks.priority, filter.priority))
    }
    if (filter.dueBefore) {
      conditions.push(lte(schema.noteTasks.dueDate, filter.dueBefore))
    }
    if (filter.dueAfter) {
      conditions.push(gte(schema.noteTasks.dueDate, filter.dueAfter))
    }

    const tasks = await db
      .select({
        id: schema.noteTasks.id,
        notebookId: schema.noteTasks.notebookId,
        noteId: schema.noteTasks.noteId,
        text: schema.noteTasks.text,
        isCompleted: schema.noteTasks.isCompleted,
        dueDate: schema.noteTasks.dueDate,
        priority: schema.noteTasks.priority,
        lineIndex: schema.noteTasks.lineIndex,
        createdAt: schema.noteTasks.createdAt,
        updatedAt: schema.noteTasks.updatedAt,
        noteTitle: schema.notes.title,
      })
      .from(schema.noteTasks)
      .leftJoin(schema.notes, eq(schema.noteTasks.noteId, schema.notes.id))
      .where(and(...conditions))

    return tasks
  })

  // Update a task (toggle completion, change due date/priority)
  ipcMain.handle(IPC_CHANNELS.TASKS_UPDATE, async (_event, id: string, data: Record<string, unknown>) => {
    const db = getDatabase()
    const now = new Date().toISOString()

    await db
      .update(schema.noteTasks)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.noteTasks.id, id))

    // Get updated task
    const rows = await db
      .select()
      .from(schema.noteTasks)
      .where(eq(schema.noteTasks.id, id))
    const task = rows[0]
    if (!task) return null

    // Also update the checkbox in the note content
    const noteRows = await db
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.id, task.noteId))
    const note = noteRows[0]

    if (note && data.isCompleted !== undefined) {
      const lines = note.content.split(/\n/)
      let taskLineCount = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Check for markdown task
        const mdMatch = line.match(/^([-*]\s*\[)([ xX])(\]\s*.+)/)
        if (mdMatch) {
          if (taskLineCount === task.lineIndex) {
            const check = data.isCompleted ? 'x' : ' '
            lines[i] = `${mdMatch[1]}${check}${mdMatch[3]}`
            break
          }
          taskLineCount++
          continue
        }

        // Check for HTML data-checked
        if (line.includes('data-checked=')) {
          if (taskLineCount === task.lineIndex) {
            lines[i] = line.replace(
              /data-checked="(true|false)"/,
              `data-checked="${data.isCompleted ? 'true' : 'false'}"`
            )
            break
          }
          taskLineCount++
        }
      }

      await db
        .update(schema.notes)
        .set({ content: lines.join('\n'), updatedAt: now })
        .where(eq(schema.notes.id, task.noteId))
    }

    return task
  })

  // Get task statistics for a notebook
  ipcMain.handle(IPC_CHANNELS.TASKS_STATS, async (_event, notebookId: string) => {
    const db = getDatabase()

    const allTasks = await db
      .select()
      .from(schema.noteTasks)
      .where(eq(schema.noteTasks.notebookId, notebookId))

    const today = new Date().toISOString().split('T')[0]

    const stats = {
      total: allTasks.length,
      completed: 0,
      incomplete: 0,
      overdue: 0,
      byPriority: { low: 0, medium: 0, high: 0, none: 0 },
    }

    for (const task of allTasks) {
      if (task.isCompleted) {
        stats.completed++
      } else {
        stats.incomplete++
        if (task.dueDate && task.dueDate < today) {
          stats.overdue++
        }
      }

      if (task.priority === 'high') stats.byPriority.high++
      else if (task.priority === 'medium') stats.byPriority.medium++
      else if (task.priority === 'low') stats.byPriority.low++
      else stats.byPriority.none++
    }

    return stats
  })
}
