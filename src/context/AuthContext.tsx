'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User } from '@/types'
import { authApi } from '@/lib/api'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<{ email: string }>
  logout: () => Promise<void>
  sendOtp: (email: string) => Promise<void>
  verifyOtp: (email: string, code: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.getMe()
      setUser(res.data.data)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    setUser(res.data.data)
  }

  const register = async (name: string, email: string, password: string) => {
    await authApi.register({ name, email, password })
    return { email }
  }

  const logout = async () => {
    await authApi.logout()
    setUser(null)
  }

  const sendOtp = async (email: string) => {
    await authApi.sendOtp(email)
  }

  const verifyOtp = async (email: string, code: string) => {
    await authApi.verifyOtp(email, code)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, sendOtp, verifyOtp, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
