import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'
import { CheckSquare, Square, Circle, Calendar, ArrowUpDown, FileText } from 'lucide-react'
import type { NoteTask, TaskStats } from '@shared/types'

type FilterMode = 'all' | 'incomplete' | 'completed' | 'overdue' | 'today'
type PriorityFilter = 'all' | 'high' | 'medium' | 'low'
type SortMode = 'due-date' | 'priority' | 'note'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export function TasksPanel() {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const [tasks, setTasks] = useState<NoteTask[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('priority')
  const [loading, setLoading] = useState(true)

  const notebookId = currentNotebook?.id

  const loadTasks = useCallback(async () => {
    if (!notebookId) return
    setLoading(true)

    const today = new Date().toISOString().split('T')[0]

    const listFilter: Record<string, unknown> = { notebookId }
    if (filter === 'completed') listFilter.completed = true
    if (filter === 'incomplete' || filter === 'overdue' || filter === 'today') listFilter.completed = false
    if (filter === 'overdue') listFilter.dueBefore = today
    if (filter === 'today') {
      listFilter.dueAfter = today
      listFilter.dueBefore = today
    }
    if (priorityFilter !== 'all') listFilter.priority = priorityFilter

    try {
      const [taskList, taskStats] = await Promise.all([
        window.api.tasksList(listFilter as never),
        window.api.tasksStats(notebookId),
      ])
      setTasks(taskList as NoteTask[])
      setStats(taskStats as TaskStats)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [notebookId, filter, priorityFilter])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Refresh periodically for task sync
  useEffect(() => {
    const interval = setInterval(loadTasks, 5000)
    return () => clearInterval(interval)
  }, [loadTasks])

  const toggleTask = useCallback(async (task: NoteTask) => {
    try {
      await window.api.tasksUpdate(task.id, { isCompleted: !task.isCompleted })
      loadTasks()
    } catch (err) {
      console.error('Failed to toggle task:', err)
    }
  }, [loadTasks])

  const sorted = useMemo(() => {
    const arr = [...tasks]
    switch (sortMode) {
      case 'due-date':
        return arr.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return a.dueDate.localeCompare(b.dueDate)
        })
      case 'priority':
        return arr.sort((a, b) => {
          const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
          const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
          return pa - pb
        })
      case 'note':
        return arr.sort((a, b) => (a.noteTitle || '').localeCompare(b.noteTitle || ''))
      default:
        return arr
    }
  }, [tasks, sortMode])

  const today = new Date().toISOString().split('T')[0]
  const completionPct = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  if (!notebookId) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm">
        Select a notebook to view tasks
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
              <CheckSquare className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Tasks</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {stats ? `${stats.total} total \u00B7 ${completionPct}% complete` : 'Loading...'}
                {stats && stats.overdue > 0 && (
                  <span className="text-red-500 ml-1">\u00B7 {stats.overdue} overdue</span>
                )}
              </p>
            </div>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1">
            <ArrowUpDown size={14} className="text-zinc-400" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="text-xs bg-transparent text-zinc-500 dark:text-zinc-400 border-none outline-none cursor-pointer"
            >
              <option value="priority">Priority</option>
              <option value="due-date">Due Date</option>
              <option value="note">Note</option>
            </select>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'incomplete', 'completed', 'overdue', 'today'] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'incomplete' ? 'Incomplete' : f === 'completed' ? 'Completed' : f === 'overdue' ? 'Overdue' : 'Today'}
            </button>
          ))}

          <div className="w-px h-4 bg-black/[0.08] dark:bg-white/[0.08] mx-1" />

          {(['all', 'high', 'medium', 'low'] as PriorityFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                priorityFilter === p
                  ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
              }`}
            >
              {p !== 'all' && (
                <span className={`w-2 h-2 rounded-full ${
                  p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
              )}
              {p === 'all' ? 'Any Priority' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-zinc-400 dark:text-zinc-500 text-sm">
            Loading tasks...
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState filter={filter} priorityFilter={priorityFilter} />
        ) : (
          <div className="space-y-1">
            {sorted.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                onToggle={() => toggleTask(task)}
                onNavigateToNote={() => setActiveView('notes')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskRow({
  task,
  today,
  onToggle,
  onNavigateToNote,
}: {
  task: NoteTask
  today: string
  onToggle: () => void
  onNavigateToNote: () => void
}) {
  const isOverdue = !task.isCompleted && task.dueDate && task.dueDate < today
  const isToday = task.dueDate === today

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group ${
      task.isCompleted ? 'opacity-60' : ''
    }`}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="mt-0.5 flex-shrink-0 text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
      >
        {task.isCompleted ? (
          <CheckSquare size={18} className="text-emerald-500 dark:text-emerald-400" />
        ) : (
          <Square size={18} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${
          task.isCompleted
            ? 'line-through text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-800 dark:text-zinc-200'
        }`}>
          {task.text}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Priority */}
          {task.priority && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              task.priority === 'high'
                ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                : task.priority === 'medium'
                ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
            }`}>
              <Circle size={6} className="fill-current" />
              {task.priority}
            </span>
          )}

          {/* Due date */}
          {task.dueDate && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              isOverdue
                ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                : isToday
                ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400'
            }`}>
              <Calendar size={10} />
              {task.dueDate}
            </span>
          )}

          {/* Source note */}
          {task.noteTitle && (
            <button
              onClick={onNavigateToNote}
              className="inline-flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
            >
              <FileText size={10} />
              {task.noteTitle}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ filter, priorityFilter }: { filter: FilterMode; priorityFilter: PriorityFilter }) {
  let message = 'No tasks found'
  let sub = 'Tasks are extracted from checkboxes in your notes (- [ ] or - [x])'

  if (filter === 'completed') {
    message = 'No completed tasks'
    sub = 'Complete tasks by checking their checkboxes'
  } else if (filter === 'incomplete') {
    message = 'All tasks are complete!'
    sub = 'Great job - everything is done'
  } else if (filter === 'overdue') {
    message = 'No overdue tasks'
    sub = 'You\'re on track with all deadlines'
  } else if (filter === 'today') {
    message = 'No tasks due today'
    sub = 'Add due dates with due:YYYY-MM-DD in task text'
  }

  if (priorityFilter !== 'all') {
    message = `No ${priorityFilter} priority tasks`
    sub = 'Set priority with !high, !medium, or !low in task text'
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
        <CheckSquare size={24} className="text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{message}</p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">{sub}</p>
    </div>
  )
}
