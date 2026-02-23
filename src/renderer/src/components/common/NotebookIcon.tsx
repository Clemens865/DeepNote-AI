import type { LucideProps } from 'lucide-react'
import {
  Notebook, BookOpen, FlaskConical, Lightbulb, Target, Rocket,
  BarChart3, TestTubes, Palette, GraduationCap, BrainCircuit,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  'notebook': Notebook,
  'book-open': BookOpen,
  'flask': FlaskConical,
  'lightbulb': Lightbulb,
  'target': Target,
  'rocket': Rocket,
  'bar-chart': BarChart3,
  'test-tubes': TestTubes,
  'palette': Palette,
  'graduation': GraduationCap,
  'brain': BrainCircuit,
}

interface NotebookIconProps {
  iconId: string
  size?: number
  className?: string
}

export function NotebookIcon({ iconId, size = 24, className = '' }: NotebookIconProps) {
  const Icon = ICON_MAP[iconId]

  if (!Icon) {
    return <span className={className} style={{ fontSize: size }}>{iconId}</span>
  }

  return <Icon className={`text-zinc-500 dark:text-zinc-400 ${className}`} size={size} />
}
