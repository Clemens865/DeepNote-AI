import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface DataTableViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

function DataTableContent({ data, maxHeight }: { data: Record<string, unknown>; maxHeight: string }) {
  const tableTitle = data.title as string | undefined
  const columns = data.columns as string[] | undefined
  const rows = data.rows as string[][] | undefined

  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(colIndex)
      setSortDir('asc')
    }
  }

  const sortedRows = useMemo(() => {
    if (!rows || sortCol === null) return rows || []
    return [...rows].sort((a, b) => {
      const aVal = a[sortCol] ?? ''
      const bVal = b[sortCol] ?? ''
      const numA = parseFloat(aVal)
      const numB = parseFloat(bVal)
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDir === 'asc' ? numA - numB : numB - numA
      }
      return sortDir === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    })
  }, [rows, sortCol, sortDir])

  if (!columns || !rows) return null

  return (
    <div className="space-y-3">
      {tableTitle && <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tableTitle}</h4>}
      <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700" style={{ maxHeight }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 dark:bg-slate-800">
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {col}
                    {sortCol === i && (
                      sortDir === 'asc'
                        ? <ArrowUp size={12} className="text-indigo-500" />
                        : <ArrowDown size={12} className="text-indigo-500" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-slate-200 dark:border-slate-700 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 even:bg-slate-50/50 dark:even:bg-slate-800/30"
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 text-right">{rows.length} rows</p>
    </div>
  )
}

export function DataTableView({ data, isFullscreen, onCloseFullscreen, title }: DataTableViewProps) {
  return (
    <>
      <DataTableContent data={data} maxHeight="500px" />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title} wide>
        <DataTableContent data={data} maxHeight="calc(100vh - 140px)" />
      </FullscreenWrapper>
    </>
  )
}
