'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUIStore } from '@/store/ui-store'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavLinkProps {
  item: NavItem
}

export function NavLink({ item }: NavLinkProps): JSX.Element {
  const pathname = usePathname()
  const { sidebarOpen } = useUIStore()
  const isActive = pathname === item.href

  const Icon = item.icon

  return (
    <Link
      href={item.href}
      title={sidebarOpen ? undefined : item.label}
      className={`
        nav-item flex h-10 items-center gap-3 overflow-hidden px-3 py-2
        ${isActive ? 'active' : 'text-text-muted hover:text-text-primary'}
        ${sidebarOpen ? '' : 'justify-center px-0'}
      `}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <AnimatePresence>
        {sidebarOpen && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden whitespace-nowrap text-sm font-medium"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )
}

export default NavLink
