// Singleton Socket.IO client. Re-creates the connection whenever the JWT changes.
// Subscribers register listeners via socket.on(...) as usual; we just manage
// the lifecycle here.

import { io } from "socket.io-client"

const URL = import.meta.env.VITE_SOCKET_URL || ""   // blank -> same origin as Vite proxy

let sock = null

export function getSocket() {
  return sock
}

export function connectSocket(token) {
  if (sock) { try { sock.disconnect() } catch {} sock = null }
  if (!token) return null
  sock = io(URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 800,
  })
  // Dev-time logging — comment out in production if noisy.
  sock.on("connect",    () => console.log("[socket] connected",    sock.id))
  sock.on("disconnect", (r) => console.log("[socket] disconnected", r))
  sock.on("connect_error", (e) => console.warn("[socket] connect_error", e.message))
  return sock
}

export function disconnectSocket() {
  if (sock) { sock.disconnect(); sock = null }
}
