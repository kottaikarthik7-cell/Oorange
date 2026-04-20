// Global auth + realtime wiring.
//
// Provides:
//   user, token     — current session
//   signup/login/verify/logout/refresh
//   socket          — live Socket.IO instance (null while logged out)
//
// On successful login/verify we call connectSocket(token) which joins the
// user into their personal room and every activity they belong to (server
// logic in realtime.js).

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { api, setToken } from "../api.js"
import { connectSocket, disconnectSocket, getSocket } from "../socket.js"

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setTok]       = useState(() => localStorage.getItem("orange.token") || "")
  const [loading, setLoading] = useState(true)
  const [socket, setSocket]   = useState(null)

  const applyToken = useCallback((t) => {
    setToken(t)
    setTok(t)
    if (t) setSocket(connectSocket(t))
    else   { disconnectSocket(); setSocket(null) }
  }, [])

  // On boot, if we have a token, re-fetch /me to validate it and load profile.
  useEffect(() => {
    let dead = false
    async function boot() {
      if (!token) { setLoading(false); return }
      try {
        const { user } = await api.me()
        if (dead) return
        setUser(user)
        setSocket(connectSocket(token))
      } catch {
        applyToken("")
      } finally {
        if (!dead) setLoading(false)
      }
    }
    boot()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (email, password) => {
    const { token, user } = await api.login({ email, password })
    applyToken(token); setUser(user)
    return user
  }
  const signup = async (payload) => {
    // returns { userId, needsVerification }
    return api.signup(payload)
  }
  const verify = async (email, code) => {
    const { token, user } = await api.verify({ email, code })
    applyToken(token); setUser(user)
    return user
  }
  const logout = () => {
    applyToken(""); setUser(null)
  }
  const refresh = async () => {
    const { user } = await api.me()
    setUser(user)
    return user
  }
  const patch = async (p) => {
    const { user } = await api.updateMe(p)
    setUser(user)
    return user
  }

  const value = {
    user, token, loading, socket,
    login, signup, verify, logout, refresh, patch,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useAuth outside <AuthProvider>")
  return v
}

// Convenience for components that just want the socket.
export function useSocket() {
  const { socket } = useAuth()
  return socket || getSocket()
}
