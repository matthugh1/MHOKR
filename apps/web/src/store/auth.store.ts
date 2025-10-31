import { create } from 'zustand'
import { User } from '@okr-nexus/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setAccessToken: (token: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setAccessToken: (token) => {
    if (token) {
      localStorage.setItem('access_token', token)
    } else {
      localStorage.removeItem('access_token')
    }
    set({ accessToken: token })
  },
  logout: () => {
    localStorage.removeItem('access_token')
    set({ user: null, accessToken: null, isAuthenticated: false })
  },
}))




