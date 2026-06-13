import type React from 'react'

interface SettingsSectionProps {
  title: string
  description?: string
  icon: React.ReactNode
  children: React.ReactNode
}

export function SettingsSection({
  title,
  description,
  icon,
  children,
}: SettingsSectionProps): JSX.Element {
  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center gap-3 border-b border-border-subtle pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}
