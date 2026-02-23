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
      {tableTitle && <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{tableTitle}</h4>}
      <div className="overflow-auto rounded-lg border border-black/[0.06] dark:border-white/[0.06]" style={{ maxHeight }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-black/[0.02] dark:bg-white/[0.02]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 border-b border-black/[0.06] dark:border-white/[0.06] cursor-pointer select-none hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
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
                className="border-b border-black/[0.06] dark:border-white/[0.06] last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] even:bg-black/[0.02] dark:even:bg-white/[0.02]"
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 text-right">{rows.length} rows</p>
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
