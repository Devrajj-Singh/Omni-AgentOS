import { create } from 'zustand'
import type { ApprovalRequest } from '@/types'

interface ApprovalState {
  pendingApprovals: ApprovalRequest[]
  addApproval: (request: ApprovalRequest) => void
  resolveApproval: (approvalId: string, decision: 'approved' | 'rejected') => void
  completeApproval: (approvalId: string) => void
  clearApprovals: () => void
}

export const useApprovalStore = create<ApprovalState>()((set) => ({
  pendingApprovals: [],

  addApproval: (request) =>
    set((state) => ({
      pendingApprovals: [...state.pendingApprovals, request],
    })),

  resolveApproval: (approvalId, decision) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.map((approval) =>
        approval.approvalId === approvalId ? { ...approval, status: decision } : approval
      ),
    })),

  completeApproval: (approvalId) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.map((approval) =>
        approval.approvalId === approvalId && approval.status === 'approved'
          ? { ...approval, status: 'completed' }
          : approval
      ),
    })),

  clearApprovals: () => set({ pendingApprovals: [] }),
}))
