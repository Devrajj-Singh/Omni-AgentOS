'use client'

import { ChatWorkspace } from './chat-workspace'

export interface ChatInterfaceProps {
  tabId: string
}

export function ChatInterface({ tabId }: ChatInterfaceProps): JSX.Element {
  void tabId
  return <ChatWorkspace />
}

export default ChatInterface
