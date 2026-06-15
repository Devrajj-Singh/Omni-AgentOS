export type RiskLevel = 'low' | 'medium' | 'high'

export interface ApprovalRequest {
  approvalId: string
  tool: string
  args: Record<string, unknown>
  description: string
  riskLevel: RiskLevel
  taskId: string
  status: 'pending' | 'approved' | 'rejected' | 'timeout' | 'completed'
}
