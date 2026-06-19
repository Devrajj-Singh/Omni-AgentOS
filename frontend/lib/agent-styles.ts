export const AGENT_STYLES: Record<string, { label: string; color: string }> = {
  planner: { label: 'Planner', color: 'text-blue-400' },
  researcher: { label: 'Researcher', color: 'text-purple-400' },
  coder: { label: 'Coder', color: 'text-accent' },
  reviewer: { label: 'Reviewer', color: 'text-amber-400' },
}

export function agentStyle(agent: string): { label: string; color: string } {
  return AGENT_STYLES[agent] ?? { label: agent, color: 'text-text-secondary' }
}
