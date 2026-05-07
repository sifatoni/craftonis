'use client'

import { Bell, Sun, Moon, Search, LogOut, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

export function TopBar() {
  const { user, tenant, clearAuth } = useAuthStore()
  const { theme, setTheme } = useUiStore()
  const router = useRouter()

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <header
      className="flex items-center justify-between h-16 px-6 border-b flex-shrink-0"
      style={{ background: '#0A0A0A', borderColor: '#1A1A1A' }}
    >
      {/* Left — Search */}
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{
          background: '#111111',
          border: '1px solid #1A1A1A',
          color: '#606060',
          minWidth: 240,
        }}
      >
        <Search size={16} />
        <span className="text-sm">Search anything...</span>
        <span
          className="ml-auto text-xs px-1.5 py-0.5 rounded"
          style={{ background: '#1A1A1A', color: '#606060' }}
        >
          ⌘K
        </span>
      </button>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Token Balance */}
        {tenant && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ background: '#111111', border: '1px solid #1A1A1A' }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: '#A50000' }}
            />
            <span style={{ color: '#A0A0A0' }}>Tokens:</span>
            <span className="font-semibold" style={{ color: '#FFFFFF' }}>
              {tenant.tokenBalance}
            </span>
          </div>
        )}

        {/* Plan Badge */}
        {tenant && (
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor: '#2E2E2E',
              color: '#A0A0A0',
              background: 'transparent',
            }}
          >
            {tenant.plan}
          </Badge>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: '#606060' }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: '#606060' }}
        >
          <Bell size={18} />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: '#A50000' }}
          />
        </button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 rounded-lg transition-colors hover:bg-white/5">
              <Avatar className="w-8 h-8">
                <AvatarFallback
                  className="text-xs font-semibold"
                  style={{ background: '#A50000', color: '#FFFFFF' }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                  {user?.name}
                </div>
                <div className="text-xs" style={{ color: '#606060' }}>
                  {tenant?.name}
                </div>
              </div>
              <ChevronDown size={14} style={{ color: '#606060' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48"
            style={{ background: '#111111', border: '1px solid #2E2E2E' }}
          >
            <div className="px-3 py-2">
              <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                {user?.name}
              </p>
              <p className="text-xs" style={{ color: '#606060' }}>
                {user?.email}
              </p>
            </div>
            <DropdownMenuSeparator style={{ background: '#2E2E2E' }} />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer"
              style={{ color: '#DC2626' }}
            >
              <LogOut size={14} className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
