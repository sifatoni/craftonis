'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/store/auth.store'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [hydrated, isAuthenticated, router])

  // Show nothing until hydration is complete
  if (!hydrated) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: '#0A0A0A' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#A50000', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <footer className="mt-8 py-3 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-500">© 2026 Craftonis. All rights reserved.</p>
          </footer>
        </main>
      </div>
    </div>
  )
}
