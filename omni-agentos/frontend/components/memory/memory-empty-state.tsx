import { Brain } from 'lucide-react'

export function MemoryEmptyState(): JSX.Element {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <Brain className="mb-4 h-14 w-14 text-slate-600" />
      <h2 className="text-lg font-semibold text-slate-200">No memories yet</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Start a conversation and your interactions will be remembered here
      </p>
    </div>
  )
}

export default MemoryEmptyState
