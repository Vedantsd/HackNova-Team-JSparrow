import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = async () => {
    try {
      const res = await api.getMe()
      if (res && res.user) {
        setUser(res.user)
      } else {
        setUser(null)
        localStorage.removeItem('cf_token')
      }
    } catch {
      setUser(null)
      localStorage.removeItem('cf_token')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const login = async (email, password) => {
    const res = await api.login(email, password)
    if (res.token) {
      localStorage.setItem('cf_token', res.token)
    }
    setUser(res.user)
    return res.user
  }

  const register = async (userData) => {
    const res = await api.register(userData)
    if (res.token) {
      localStorage.setItem('cf_token', res.token)
    }
    setUser(res.user)
    return res.user
  }

  const logout = async () => {
    try {
      await api.logout()
    } finally {
      localStorage.removeItem('cf_token')
      setUser(null)
    }
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
    refreshUser: checkAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
