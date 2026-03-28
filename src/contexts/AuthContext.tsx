import React, { createContext, useContext, useEffect, useState } from 'react'
import { clearSession, getSession, saveSession, type Session } from '../lib/storage'

interface AuthContextType {
  session: Session | null
  loading: boolean
  login: (session: Session) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const s = getSession()
    setSession(s)
    setLoading(false)
  }, [])

  const login = (s: Session) => {
    saveSession(s)
    setSession(s)
  }

  const logout = () => {
    clearSession()
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
