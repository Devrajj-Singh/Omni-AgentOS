'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, FileEdit, Loader2, Terminal, XCircle } from 'lucide-react'
import { resolveApproval } from '@/services/api'
import { useApprovalStore } from '@/store/approval-store'
import { useChatStore } from '@/store/chat-store'
import type { ApprovalRequest, RiskLevel } from '@/types'

interface ApprovalBubbleProps {
  approval: ApprovalRequest
}

const TOOL_ICONS = {
  write_file_tool: FileEdit,
  run_command_tool: Terminal,
}

const RISK_STYLES: Record<RiskLevel, { border: string; bg: string; text: string; label: string }> = {
  low: {
    border: 'border-status-green/30',
    bg: 'bg-status-green/5',
    text: 'text-status-green',
    label: 'Low risk',
  },
  medium: {
    border: 'border-status-yellow/30',
    bg: 'bg-status-yellow/5',
    text: 'text-status-yellow',
    label: 'Medium risk',
  },
  high: {
    border: 'border-status-red/30',
    bg: 'bg-status-red/5',
    text: 'text-status-red',
    label: 'High risk',
  },
}

export function ApprovalBubble({ approval }: ApprovalBubbleProps): JSX.Element {
  const [isResolving, setIsResolving] = useState(false)
  const resolveInStore = useApprovalStore((state) => state.resolveApproval)
  const sessionId = useChatStore((state) => state.sessionId)

  const Icon = TOOL_ICONS[approval.tool as keyof typeof TOOL_ICONS] ?? AlertTriangle
  const risk = RISK_STYLES[approval.riskLevel] ?? RISK_STYLES.medium
  const isPending = approval.status === 'pending'

  const handleDecision = async (decision: 'approved' | 'rejected'): Promise<void> => {
    if (!isPending || isResolving) return
    setIsResolving(true)
    try {
      await resolveApproval(approval.approvalId, sessionId, decision)
      resolveInStore(approval.approvalId, decision)
    } catch (error) {
      console.error('Approval resolution failed:', error)
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`mx-4 my-2 rounded-card border p-4 ${risk.border} ${risk.bg}`}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-btn border ${risk.border} bg-bg-surface`}>
          <Icon className={`h-4 w-4 ${risk.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">Action requires approval</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${risk.border} ${risk.text}`}>
              {risk.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">{approval.description}</p>
        </div>
      </div>

      {Object.keys(approval.args).length > 0 && (
        <div className="mb-3 rounded-card border border-border-default bg-bg-base p-3">
          {Object.entries(approval.args).map(([key, value]) => {
            const text = String(value)
            return (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 font-mono text-text-muted">{key}:</span>
                <span className="break-all font-mono text-text-secondary">
                  {text.slice(0, 120)}
                  {text.length > 120 ? '...' : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {isPending ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleDecision('approved')}
            disabled={isResolving}
            className="flex flex-1 items-center justify-center gap-2 rounded-btn border border-status-green/30 bg-status-green/10 py-2 text-sm font-medium text-status-green transition-colors hover:bg-status-green/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
            Approve
          </button>
          <button
            type="button"
            onClick={() => void handleDecision('rejected')}
            disabled={isResolving}
            className="flex flex-1 items-center justify-center gap-2 rounded-btn border border-status-red/30 bg-status-red/10 py-2 text-sm font-medium text-status-red transition-colors hover:bg-status-red/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </button>
        </div>
      ) : (
        <div className={`flex items-center gap-2 text-sm font-medium ${approval.status === 'approved' ? 'text-status-green' : 'text-status-red'}`}>
          {approval.status === 'approved' ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Approved - executing...
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" />
              Rejected - action cancelled
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}
