import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface Tenant {
  id: string
  name: string
  plan: string
  tokenBalance: number
}

interface AuthState {
  user: User | null
  tenant: Tenant | null
  accessToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, tenant: Tenant, accessToken: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, tenant, accessToken) => {
        localStorage.setItem('craftonis_access_token', accessToken)
        set({ user, tenant, accessToken, isAuthenticated: true })
      },
      clearAuth: () => {
        localStorage.removeItem('craftonis_access_token')
        set({ user: null, tenant: null, accessToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'craftonis-auth',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
