'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/ui.store'
import {
  LayoutDashboard, Radar, Briefcase, FileSearch,
  Code2, Video, FileText, Bot, Users, Settings, ChevronLeft,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/leads', icon: Radar, label: 'Lead Generation' },
  { href: '/jobs', icon: Briefcase, label: 'Jobs & Pipeline' },
  { href: '/cv', icon: FileSearch, label: 'CV Scoring' },
  { href: '/interviews', icon: Code2, label: 'Interviews' },
  { href: '/meetings', icon: Video, label: 'Meeting Ledger' },
  { href: '/minutes', icon: FileText, label: 'Meeting Minutes' },
  { href: '/onboarding', icon: Bot, label: 'AI Onboarding' },
  { href: '/hrm', icon: Users, label: 'HRM' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUiStore()

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col h-screen border-r flex-shrink-0"
      style={{
        background: '#0D0D0D',
        borderColor: '#1A1A1A',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-16 px-4 border-b flex-shrink-0"
        style={{ borderColor: '#1A1A1A' }}
      >
        <AnimatePresence mode="wait">
          {sidebarCollapsed ? (
            <motion.div
              key="icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: '#A50000', fontFamily: 'var(--font-syne)' }}
            >
              C
            </motion.div>
          ) : (
            <motion.div
              key="logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Image src="/logo-dark.svg" alt="Craftonis" width={130} height={33} priority />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  'relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 cursor-pointer transition-colors group',
                  isActive
                    ? 'bg-crimson-dark'
                    : 'hover:bg-white/5'
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                    style={{ background: '#A50000' }}
                    transition={{ duration: 0.2 }}
                  />
                )}

                <Icon
                  size={20}
                  className="flex-shrink-0"
                  style={{ color: isActive ? '#A50000' : '#606060' }}
                />

                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                      style={{ color: isActive ? '#FFFFFF' : '#A0A0A0' }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Tooltip when collapsed */}
                {sidebarCollapsed && (
                  <div
                    className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                    style={{
                      background: '#1A1A1A',
                      color: '#FFFFFF',
                      border: '1px solid #2E2E2E',
                    }}
                  >
                    {item.label}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div
        className="p-3 border-t flex-shrink-0"
        style={{ borderColor: '#1A1A1A' }}
      >
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full py-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: '#606060' }}
        >
          <motion.div
            animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronLeft size={18} />
          </motion.div>
          {!sidebarCollapsed && (
            <span className="ml-2 text-xs">Collapse</span>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
