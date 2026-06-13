'use client'

import { useWorkspaceStore } from '@/store/workspace-store'
import { ChatInterface } from '@/components/chat/chat-interface'

export interface MainWorkspaceProps {}

export function MainWorkspace(): JSX.Element {
  const { openTabs, activeTabId } = useWorkspaceStore()

  return (
    <div className="h-full flex flex-col bg-charcoal">
      {/* Tab bar */}
      {openTabs.length > 1 && (
        <div className="flex items-center border-b border-slate-800 bg-slate-900">
          {openTabs.map((tabId) => (
            <div
              key={tabId}
              className={`
                px-4 py-2 text-sm font-medium capitalize
                ${
                  activeTabId === tabId
                    ? 'text-accent-blue border-b-2 border-accent-blue'
                    : 'text-text-muted'
                }
              `}
            >
              {tabId}
            </div>
          ))}
        </div>
      )}

      {/* Active tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTabId === 'chat' && <ChatInterface tabId="chat" />}
      </div>
    </div>
  )
}

export default MainWorkspace
