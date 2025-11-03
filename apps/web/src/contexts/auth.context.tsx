'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isSuperuser?: boolean
  features?: {
    rbacInspector?: boolean
  [key: string]: any
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  impersonating: boolean
  originalUser: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (data: RegisterData) => Promise<void>
  impersonate: (userId: string) => Promise<void>
  stopImpersonating: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [impersonating, setImpersonating] = useState(false)
  const [originalUser, setOriginalUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if we're already impersonating first
    const impData = localStorage.getItem('impersonation_data')
    if (impData) {
      try {
        const { originalUser: orig } = JSON.parse(impData)
        setOriginalUser(orig)
        setImpersonating(true)
      } catch (e) {
        // Invalid data, clear it
        localStorage.removeItem('impersonation_data')
      }
    }
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await api.get('/users/me')
      setUser(response.data)
    } catch (error) {
      localStorage.removeItem('access_token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      localStorage.setItem('access_token', response.data.accessToken)
      setUser(response.data.user)
      router.push('/dashboard')
    } catch (error: any) {
      // Re-throw with better error message
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.'
      throw new Error(errorMessage)
    }
  }

  const register = async (data: RegisterData) => {
    const response = await api.post('/auth/register', data)
    localStorage.setItem('access_token', response.data.accessToken)
    setUser(response.data.user)
    router.push('/dashboard')
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('impersonation_data')
    setUser(null)
    setImpersonating(false)
    setOriginalUser(null)
    router.push('/login')
  }

  const impersonate = async (userId: string) => {
    try {
      const response = await api.post(`/superuser/impersonate/${userId}`)
      const { user: targetUser, accessToken, impersonatedBy } = response.data
      
      // Store original user info and token
      const currentUser = user
      const originalToken = localStorage.getItem('access_token')
      localStorage.setItem('impersonation_data', JSON.stringify({
        originalUser: currentUser,
        originalToken: originalToken,
        impersonatedBy,
      }))
      
      // Switch to target user token
      localStorage.setItem('access_token', accessToken)
      setOriginalUser(currentUser)
      setImpersonating(true)
      setUser(targetUser)
      
      // Refresh the page to reload all context
      window.location.reload()
    } catch (error) {
      console.error('Failed to impersonate user:', error)
      alert('Failed to impersonate user')
    }
  }

  const stopImpersonating = async () => {
    const impData = localStorage.getItem('impersonation_data')
    if (!impData) return
    
    try {
      const { originalToken } = JSON.parse(impData)
      
      // Restore original token
      if (originalToken) {
        localStorage.setItem('access_token', originalToken)
      }
      
      // Clear impersonation data
      localStorage.removeItem('impersonation_data')
      setImpersonating(false)
      setOriginalUser(null)
      
      // Reload to refresh context with original user
      window.location.reload()
    } catch (error) {
      console.error('Failed to stop impersonating:', error)
      // Fallback: clear everything and logout
      localStorage.removeItem('impersonation_data')
      logout()
    }
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      register,
      impersonate,
      stopImpersonating,
      impersonating,
      originalUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


