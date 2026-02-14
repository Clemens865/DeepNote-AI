import { useState } from 'react'
import { ArrowUp, ArrowDown, Copy, Check } from 'lucide-react'
import { ArtifactWrapper } from './ArtifactWrapper'

interface ChatArtifactTableProps {
  data: { columns: string[]; rows: string[][] }
}

export function ChatArtifactTable({ data }: ChatArtifactTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [copied, setCopied] = useState(false)

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortAsc(!sortAsc)
    } else {
      setSortCol(colIndex)
      setSortAsc(true)
    }
  }

  const sortedRows = [...data.rows]
  if (sortCol !== null) {
    sortedRows.sort((a, b) => {
      const va = a[sortCol] ?? ''
      const vb = b[sortCol] ?? ''
      const na = parseFloat(va)
      const nb = parseFloat(vb)
      if (!isNaN(na) && !isNaN(nb)) {
        return sortAsc ? na - nb : nb - na
      }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }

  const handleCopyCsv = async () => {
    const header = data.columns.join(',')
    const rows = data.rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
    await navigator.clipboard.writeText([header, ...rows].join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ArtifactWrapper
      title="Table"
      jsonData={data}
      headerActions={
        <button
          onClick={handleCopyCsv}
          className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'CSV'}
        </button>
      }
    >
      <div className="max-h-[300px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
            <tr>
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === i && (
                      sortAsc ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, ri) => (
              <tr
                key={ri}
                className={ri % 2 === 0
                  ? 'bg-white dark:bg-slate-900'
                  : 'bg-slate-50 dark:bg-slate-800/50'
                }
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ArtifactWrapper>
  )
}
