import { Code2 } from 'lucide-react'

const ABOUT_ITEMS = [
  { label: 'Version', value: 'v0.1.0' },
  { label: 'Frontend', value: 'Next.js 15 + React + TypeScript' },
  { label: 'Backend', value: 'FastAPI + Python' },
  { label: 'AI', value: 'LangGraph + Groq' },
  { label: 'Memory', value: 'ChromaDB + Sentence Transformers' },
]

export function AboutSection(): JSX.Element {
  return (
    <div>
      <div className="space-y-3">
        {ABOUT_ITEMS.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-border-subtle py-2 last:border-0">
            <span className="text-xs text-text-muted">{label}</span>
            <span className="text-right text-xs font-medium text-text-secondary">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
