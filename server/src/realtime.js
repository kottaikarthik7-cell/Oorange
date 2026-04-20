// Socket.IO handlers: presence, chat, typing, location, activity events.
//
// Rooms we use:
//   user:<id>          — personal channel for DMs, notifications, push-style deliveries
//   activity:<id>      — per-activity room for chat, typing, location broadcast
//   global             — low-volume broadcasts (new activity, new post)
//
// The browser connects with `io({ auth: { token } })`. We verify the JWT in the
// handshake and load the user before letting events fire.

import { verifyToken } from "./auth.js"
import { stmts } from "./db.js"

export function wireRealtime(io) {
  // Track presence in-memory: userId -> Set<socketId>
  const presence = new Map()
  // Track typing: `activityId:userId` -> timeoutHandle
  const typingTimers = new Map()

  function markOnline(userId, socketId) {
    if (!presence.has(userId)) presence.set(userId, new Set())
    presence.get(userId).add(socketId)
    stmts.touchLastSeen.run(Math.floor(Date.now() / 1000), userId)
  }
  function markOffline(userId, socketId) {
    const set = presence.get(userId)
    if (set) {
      set.delete(socketId)
      if (set.size === 0) presence.delete(userId)
    }
  }

  // Middleware: authenticate every incoming connection.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error("unauthorized"))
    const claims = verifyToken(token)
    if (!claims) return next(new Error("unauthorized"))
    const user = stmts.getUserById.get(claims.sub)
    if (!user) return next(new Error("unauthorized"))
    socket.data.user = {
      id: user.id, name: user.name, handle: user.handle, avatarColor: user.avatar_color,
    }
    next()
  })

  io.on("connection", socket => {
    const { user } = socket.data
    markOnline(user.id, socket.id)
    socket.join(`user:${user.id}`)
    socket.join("global")
    // Join rooms for every activity the user belongs to — lets them receive chat events.
    const rows = stmts.getMembers // reuse: we need user's activities though
    const activities = io.app?.locals?.db?.prepare?.(
      "SELECT activity_id FROM activity_members WHERE user_id = ?"
    ) // fallback below
    try {
      const memberRows = io.app?.locals?.db
        ? activities.all(user.id)
        : []
      memberRows.forEach(r => socket.join(`activity:${r.activity_id}`))
    } catch {}

    // Broadcast presence update.
    io.to("global").emit("presence:update", { userId: user.id, online: true })

    // Let the client ask about who's online right now.
    socket.on("presence:query", (ids, ack) => {
      const result = {}
      for (const id of ids || []) result[id] = presence.has(id)
      ack?.(result)
    })

    // Join or leave activity rooms dynamically.
    socket.on("activity:join_room", (activityId) => {
      if (!activityId) return
      socket.join(`activity:${activityId}`)
    })
    socket.on("activity:leave_room", (activityId) => {
      if (!activityId) return
      socket.leave(`activity:${activityId}`)
    })

    // Typing indicators — auto-clear after 4s if no refresh.
    socket.on("chat:typing", ({ activityId, typing }) => {
      const key = `${activityId}:${user.id}`
      if (typing) {
        io.to(`activity:${activityId}`).except(socket.id).emit("chat:typing", {
          activityId, userId: user.id, name: user.name, typing: true,
        })
        clearTimeout(typingTimers.get(key))
        typingTimers.set(key, setTimeout(() => {
          io.to(`activity:${activityId}`).except(socket.id).emit("chat:typing", {
            activityId, userId: user.id, typing: false,
          })
          typingTimers.delete(key)
        }, 4000))
      } else {
        clearTimeout(typingTimers.get(key))
        typingTimers.delete(key)
        io.to(`activity:${activityId}`).except(socket.id).emit("chat:typing", {
          activityId, userId: user.id, typing: false,
        })
      }
    })

    // Live location: a participant broadcasts their current coords while en route.
    // Throttle client-side; we just relay.
    socket.on("location:update", ({ activityId, lat, lng, heading }) => {
      if (!activityId || typeof lat !== "number" || typeof lng !== "number") return
      io.to(`activity:${activityId}`).except(socket.id).emit("location:update", {
        activityId, userId: user.id, name: user.name, avatarColor: user.avatarColor,
        lat, lng, heading: heading ?? null, ts: Date.now(),
      })
    })

    // WebRTC signaling relay (DM calls).
    socket.on("call:offer", ({ toUserId, sdp, kind }) => {
      io.to(`user:${toUserId}`).emit("call:offer", {
        fromUserId: user.id, fromName: user.name, sdp, kind,
      })
    })
    socket.on("call:answer", ({ toUserId, sdp }) => {
      io.to(`user:${toUserId}`).emit("call:answer", { fromUserId: user.id, sdp })
    })
    socket.on("call:ice", ({ toUserId, candidate }) => {
      io.to(`user:${toUserId}`).emit("call:ice", { fromUserId: user.id, candidate })
    })
    socket.on("call:end", ({ toUserId }) => {
      io.to(`user:${toUserId}`).emit("call:end", { fromUserId: user.id })
    })

    socket.on("disconnect", () => {
      markOffline(user.id, socket.id)
      if (!presence.has(user.id)) {
        io.to("global").emit("presence:update", { userId: user.id, online: false })
      }
    })
  })

  return io
}
