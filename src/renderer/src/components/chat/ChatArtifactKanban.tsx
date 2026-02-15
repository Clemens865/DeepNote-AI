import { ArtifactWrapper } from './ArtifactWrapper'

interface KanbanItem {
  task: string
  assignee?: string
  priority?: 'high' | 'medium' | 'low'
  status?: 'todo' | 'in-progress' | 'done'
}

interface ChatArtifactKanbanProps {
  data: {
    title?: string
    items: KanbanItem[]
  }
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  low: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
}

const statusColors: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
}

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
}

export function ChatArtifactKanban({ data }: ChatArtifactKanbanProps) {
  const groups: Record<string, KanbanItem[]> = { todo: [], 'in-progress': [], done: [] }
  for (const item of data.items) {
    const status = item.status || 'todo'
    if (!groups[status]) groups[status] = []
    groups[status].push(item)
  }

  const activeGroups = Object.entries(groups).filter(([, items]) => items.length > 0)

  return (
    <ArtifactWrapper title={data.title || 'Action Items'} jsonData={data}>
      <div className="p-3 bg-white dark:bg-slate-900">
        {activeGroups.length > 1 ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${activeGroups.length}, 1fr)` }}>
            {activeGroups.map(([status, items]) => (
              <div key={status}>
                <div className={`text-[10px] font-bold uppercase tracking-wide mb-2 px-2 py-1 rounded ${statusColors[status] || statusColors.todo}`}>
                  {statusLabels[status] || status} ({items.length})
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <KanbanCard key={i} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {data.items.map((item, i) => (
              <KanbanCard key={i} item={item} showStatus />
            ))}
          </div>
        )}
      </div>
    </ArtifactWrapper>
  )
}

function KanbanCard({ item, showStatus }: { item: KanbanItem; showStatus?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2.5 bg-slate-50 dark:bg-slate-800/50">
      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">{item.task}</p>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {item.assignee && (
          <span className="text-[9px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 rounded px-1.5 py-0.5">
            {item.assignee}
          </span>
        )}
        {item.priority && (
          <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 ${priorityColors[item.priority] || ''}`}>
            {item.priority}
          </span>
        )}
        {showStatus && item.status && (
          <span className={`text-[9px] font-medium rounded px-1.5 py-0.5 ${statusColors[item.status] || statusColors.todo}`}>
            {statusLabels[item.status] || item.status}
          </span>
        )}
      </div>
    </div>
  )
}
