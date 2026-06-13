'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Brain, ChevronLeft, ChevronRight, Code2, LayoutDashboard, Search, Settings, Sparkles, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/store/ui-store'

const navItems = [
  { label: 'Workspace', href: '/workspace', icon: LayoutDashboard },
  { label: 'Developer', href: '/developer', icon: Code2 },
  { label: 'Research', href: '/research', icon: Search },
  { label: 'Memory', href: '/memory', icon: Brain },
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  variant?: 'side' | 'bottom'
}

export function Sidebar({ variant = 'side' }: SidebarProps): JSX.Element {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useUIStore()

  if (variant === 'bottom') {
    return (
      <nav className="flex h-14 w-full items-center justify-around border-t border-border-default bg-bg-surface px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:bg-bg-raised hover:text-text-primary'
              }`}
            >
              <Icon className="h-4 w-4" />
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <motion.aside
      animate={{ width: sidebarOpen ? 220 : 56 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col overflow-hidden bg-bg-surface"
    >
      <div
        className="flex h-14 items-center border-b border-border-default px-3"
        style={{ justifyContent: sidebarOpen ? 'space-between' : 'center' }}
      >
        {sidebarOpen ? (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <div className="text-sm font-semibold leading-none text-text-primary">Omni</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-muted">AgentOS</div>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-raised hover:text-text-primary"
              title="Collapse"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={toggleSidebar}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-raised hover:text-text-primary"
            title="Expand"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-hidden px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!sidebarOpen ? item.label : undefined}
              className={`nav-item h-9 ${isActive ? 'active' : ''} ${
                sidebarOpen ? 'w-full px-2.5' : 'mx-auto w-10 justify-center gap-0 p-0'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
              <AnimatePresence mode="wait">
                {sidebarOpen && (
                  <motion.span
                    key="label"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden whitespace-nowrap text-sm"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border-default p-2">
        <div className={`flex items-center gap-2 rounded-md p-2 ${sidebarOpen ? '' : 'justify-center'}`}>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-raised">
            <User className="h-3 w-3 text-text-muted" />
          </div>
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div
                key="footer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-xs font-medium text-text-secondary">Local workspace</p>
                <p className="text-[10px] text-text-muted">v0.1.0</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}

export default Sidebar
