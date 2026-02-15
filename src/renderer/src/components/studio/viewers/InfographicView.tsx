import { Download } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface InfographicViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

function InfographicContent({ data }: { data: Record<string, unknown> }) {
  const imagePath = data.imagePath as string | undefined

  if (!imagePath) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No infographic generated yet.</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        <img
          src={`local-file://${imagePath}`}
          alt="Infographic"
          className="w-full h-auto"
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: 'infographic.png' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <Download size={12} />
          Download infographic
        </button>
      </div>
    </div>
  )
}

export function InfographicView({ data, isFullscreen, onCloseFullscreen, title }: InfographicViewProps) {
  const imagePath = data.imagePath as string | undefined

  const downloadAction = imagePath ? (
    <button
      onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: 'infographic.png' })}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
      title="Download infographic"
    >
      <Download size={16} />
    </button>
  ) : undefined

  return (
    <>
      <InfographicContent data={data} />
      <FullscreenWrapper
        isOpen={isFullscreen}
        onClose={onCloseFullscreen}
        title={title}
        actions={downloadAction}
        wide
      >
        {imagePath && (
          <div className="flex items-center justify-center h-full">
            <img
              src={`local-file://${imagePath}`}
              alt="Infographic"
              className="max-w-full max-h-[calc(100vh-120px)] object-contain"
            />
          </div>
        )}
      </FullscreenWrapper>
    </>
  )
}
