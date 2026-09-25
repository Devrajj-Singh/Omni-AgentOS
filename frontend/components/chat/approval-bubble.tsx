'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, Clock, FileEdit, Loader2, Terminal, X, XCircle } from 'lucide-react'
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
  const dismissInStore = useApprovalStore((state) => state.dismissApproval)
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
      // A 404 means the approval already expired server-side before the
      // resolution event arrived; reflect that instead of leaving a dead card.
      console.error('Approval resolution failed:', error)
      resolveInStore(approval.approvalId, 'timeout')
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={`mx-4 my-1.5 rounded-lg border p-2.5 text-sm ${risk.border} ${risk.bg}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${risk.border} bg-bg-surface`}>
          <Icon className={`h-3.5 w-3.5 ${risk.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-text-primary">Action requires approval</span>
            <span className={`rounded-full border px-1.5 py-0 text-[9px] font-medium uppercase ${risk.border} ${risk.text}`}>
              {risk.label}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-text-muted">{approval.description}</p>
        </div>
      </div>

      {Object.keys(approval.args).length > 0 && (
        <div className="mb-2 rounded-md border border-border-default bg-bg-base p-2">
          {Object.entries(approval.args).map(([key, value]) => {
            const text = String(value)
            return (
              <div key={key} className="flex items-start gap-1.5 text-[11px]">
                <span className="shrink-0 font-mono text-text-muted">{key}:</span>
                <span className="break-all font-mono text-text-secondary">
                  {text.slice(0, 100)}
                  {text.length > 100 ? '...' : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {isPending ? (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void handleDecision('approved')}
            disabled={isResolving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-status-green/30 bg-status-green/10 py-1.5 text-xs font-medium text-status-green transition-colors hover:bg-status-green/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            Approve
          </button>
          <button
            type="button"
            onClick={() => void handleDecision('rejected')}
            disabled={isResolving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-status-red/30 bg-status-red/10 py-1.5 text-xs font-medium text-status-red transition-colors hover:bg-status-red/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" />
            Reject
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          {approval.status === 'completed' ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-status-green">
              <CheckCircle className="h-3.5 w-3.5" />
              Completed
            </div>
          ) : approval.status === 'timeout' ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
              <Clock className="h-3.5 w-3.5" />
              Expired - approval window closed
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${approval.status === 'approved' ? 'text-status-green' : 'text-status-red'}`}>
              {approval.status === 'approved' ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approved - executing...
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  Rejected - action cancelled
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => dismissInStore(approval.approvalId)}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-bg-base hover:text-text-primary"
            aria-label="Dismiss approval card"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </motion.div>
  )
}
