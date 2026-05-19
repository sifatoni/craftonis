'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/ui.store'
import {
  LayoutDashboard, Radar, Briefcase, FileSearch, KanbanSquare,
  Code2, Video, Bot, Users, Settings, ChevronLeft,
  ChevronDown, CalendarOff, GitBranch, Building2, Clock
} from 'lucide-react'

const hiringManagerRoutes = ['/jobs', '/jobs-pipeline', '/cv-scoring', '/interviews', '/onboarding']

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/lead-generation', icon: Radar, label: 'Lead Generation' },
  { 
    id: 'hiring-manager',
    label: 'Hiring Manager',
    icon: Briefcase,
    children: [
      { href: '/jobs', icon: Briefcase, label: 'Job Board' },
      { href: '/jobs-pipeline', icon: KanbanSquare, label: 'Pipeline Board' },
      { href: '/cv-scoring', icon: FileSearch, label: 'CV Scoring' },
      { href: '/interviews', icon: Code2, label: 'Interviews' },
      { href: '/onboarding', icon: Bot, label: 'AI Onboarding' },
    ]
  },
  { href: '/meeting-ledger', icon: Video, label: 'Meeting Ledger' },
  {
    id: 'hrm',
    label: 'HRM',
    icon: Users,
    children: [
      { href: '/hrm', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/hrm?tab=employees', icon: Users, label: 'Employees' },
      { href: '/hrm?tab=attendance', icon: Clock, label: 'Attendance' },
      { href: '/hrm?tab=leave', icon: CalendarOff, label: 'Leave' },
      { href: '/hrm?tab=departments', icon: Building2, label: 'Departments' },
      { href: '/hrm?tab=org-chart', icon: GitBranch, label: 'Org Chart' },
    ]
  }
]

interface NavItemProps {
  href: string
  icon: any
  label: string
  isActive: boolean
  sidebarCollapsed: boolean
  isChild?: boolean
}

function NavItem({ href, icon: Icon, label, isActive, sidebarCollapsed, isChild }: NavItemProps) {
  return (
    <Link href={href}>
      <div
        className={cn(
          'relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 cursor-pointer transition-colors group',
          isActive ? 'bg-white/5' : 'hover:bg-white/5',
          isChild && 'ml-6 py-2'
        )}
      >
        {isActive && (
          <motion.div
            layoutId={isChild ? "activeNavChild" : "activeNav"}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
            style={{ background: '#A50000' }}
            transition={{ duration: 0.2 }}
          />
        )}

        <Icon
          size={isChild ? 16 : 20}
          className="flex-shrink-0"
          style={{ color: isActive ? '#A50000' : isChild ? '#404040' : '#606060' }}
        />

        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className={cn("font-medium whitespace-nowrap overflow-hidden", isChild ? "text-sm" : "text-sm")}
              style={{ color: isActive ? '#FFFFFF' : isChild ? '#808080' : '#A0A0A0' }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>

        {sidebarCollapsed && (
          <div
            className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
            style={{
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: '1px solid #2E2E2E',
            }}
          >
            {label}
          </div>
        )}
      </div>
    </Link>
  )
}

function SidebarContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab')
  const { sidebarCollapsed, toggleSidebar } = useUiStore()
  const [isHiringManagerOpen, setIsHiringManagerOpen] = useState(false)
  const [isHrmOpen, setIsHrmOpen] = useState(false)

  useEffect(() => {
    if (hiringManagerRoutes.some(route => pathname === route || pathname.startsWith(route))) {
      setIsHiringManagerOpen(true)
    }
    if (pathname === '/hrm' || pathname.startsWith('/hrm')) {
      setIsHrmOpen(true)
    }
  }, [pathname])

  const isHiringManagerActive = hiringManagerRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  )

  const isHrmActive = pathname === '/hrm' || pathname.startsWith('/hrm')

  const isSettingsActive = pathname === '/settings' || pathname.startsWith('/settings')

  const isChildActive = (childHref: string) => {
    const [childPath, childQuery] = childHref.split('?')
    if (pathname !== childPath) return false
    
    if (!childQuery) {
      return !currentTab
    }
    
    const childParams = new URLSearchParams(childQuery)
    return currentTab === childParams.get('tab')
  }

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
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {navItems.map((item) => {
          if ('children' in item) {
            const Icon = item.icon
            const isHiringManager = item.id === 'hiring-manager'
            const isGroupActive = isHiringManager ? isHiringManagerActive : isHrmActive
            const isGroupOpen = isHiringManager ? isHiringManagerOpen : isHrmOpen
            const setIsGroupOpen = isHiringManager ? setIsHiringManagerOpen : setIsHrmOpen

            return (
              <div key={item.id} className="mb-0.5">
                <div
                  onClick={() => !sidebarCollapsed && setIsGroupOpen(!isGroupOpen)}
                  className={cn(
                    'relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group',
                    isGroupActive ? 'bg-white/5' : 'hover:bg-white/5'
                  )}
                >
                  {isGroupActive && (
                    <motion.div
                      layoutId={`activeNavGroup-${item.id}`}
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                      style={{ background: '#A50000' }}
                      transition={{ duration: 0.2 }}
                    />
                  )}

                  <Icon
                    size={20}
                    className="flex-shrink-0"
                    style={{ color: isGroupActive ? '#A50000' : '#606060' }}
                  />

                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="flex-1 flex items-center justify-between overflow-hidden"
                      >
                        <span 
                          className="text-sm font-medium whitespace-nowrap"
                          style={{ color: isGroupActive ? '#FFFFFF' : '#A0A0A0' }}
                        >
                          {item.label}
                        </span>
                        <motion.div
                          animate={{ rotate: isGroupOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown size={14} style={{ color: '#606060' }} />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {sidebarCollapsed && (
                    <div
                      className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                      style={{ background: '#1A1A1A', color: '#FFFFFF', border: '1px solid #2E2E2E' }}
                    >
                      {item.label}
                    </div>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {isGroupOpen && !sidebarCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {item.children?.map((child) => {
                        const childActive = isHiringManager 
                          ? pathname === child.href 
                          : isChildActive(child.href)
                        
                        return (
                          <NavItem
                            key={child.href}
                            href={child.href}
                            icon={child.icon}
                            label={child.label}
                            isActive={childActive}
                            sidebarCollapsed={sidebarCollapsed}
                            isChild
                          />
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          }

          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href) && !hiringManagerRoutes.includes(item.href) && !pathname.startsWith('/hrm'))

          return (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={isActive}
              sidebarCollapsed={sidebarCollapsed}
            />
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div 
        className="mt-auto border-t flex-shrink-0 py-2"
        style={{ borderColor: '#1A1A1A' }}
      >
        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          isActive={isSettingsActive}
          sidebarCollapsed={sidebarCollapsed}
        />
      </div>

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

export function Sidebar() {
  return (
    <Suspense fallback={
      <div className="w-60 bg-[#0D0D0D] border-r border-[#1A1A1A]" />
    }>
      <SidebarContent />
    </Suspense>
  )
}
