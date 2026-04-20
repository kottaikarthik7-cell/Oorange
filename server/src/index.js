// Orange server entry: boots Express + Socket.IO on a single HTTP server.

import "dotenv/config"
import express from "express"
import http from "node:http"
import cors from "cors"
import path from "node:path"
import fs from "node:fs"
import { Server } from "socket.io"
import { fileURLToPath } from "node:url"

import { db } from "./db.js"
import { wireRealtime } from "./realtime.js"
import authRoutes from "./routes/auth.js"
import activitiesRoutes from "./routes/activities.js"
import messagesRoutes from "./routes/messages.js"
import postsRoutes from "./routes/posts.js"
import usersRoutes from "./routes/users.js"
import uploadsRoutes from "./routes/uploads.js"
import callsRoutes from "./routes/calls.js"
import notificationsRoutes from "./routes/notifications.js"
import collabRoutes from "./collab.js"
import aiRoutes from "./ai.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT || 4000)
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./data/uploads"
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// Normalize CLIENT_ORIGIN so a bare hostname from a Render Blueprint
// (e.g. "orange-client.onrender.com") becomes a full origin that matches
// the browser's Origin header. Also accept a comma-separated list.
function normalizeOrigin(raw) {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if (s.startsWith("http://") || s.startsWith("https://")) return s.replace(/\/$/, "")
  return "https://" + s.replace(/\/$/, "")
}
const CLIENT_ORIGIN_RAW = process.env.CLIENT_ORIGIN || "http://localhost:5173"
const ALLOWED_ORIGINS = CLIENT_ORIGIN_RAW.split(",").map(normalizeOrigin).filter(Boolean)
console.log("[orange] allowed CORS origins:", ALLOWED_ORIGINS)

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    if (process.env.NODE_ENV !== "production") {
      console.warn("[orange] rejecting origin", origin)
      return cb(new Error("origin_not_allowed"))
    }
    console.warn("[orange] unknown origin allowed (prod):", origin)
    return cb(null, true)
  },
  credentials: true,
}

const app = express()
app.locals.db = db

app.use(cors(corsOptions))
app.use(express.json({ limit: "2mb" }))
app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)))

app.get("/health", (_, res) => res.json({ ok: true, ts: Date.now() }))

const server = http.createServer(app)
const io = new Server(server, { cors: corsOptions })
io.app = app

app.use("/auth", authRoutes)
app.use("/activities", activitiesRoutes(io))
app.use("/", messagesRoutes(io))
app.use("/posts", postsRoutes(io))
app.use("/users", usersRoutes)
app.use("/uploads-api", uploadsRoutes)
app.use("/calls", callsRoutes)
app.use("/notifications", notificationsRoutes)
app.use("/activities", collabRoutes(io))
app.use("/ai", aiRoutes)

app.use((err, _, res, __) => {
  console.error("[orange] error:", err)
  res.status(500).json({ error: err.message || "server_error" })
})

wireRealtime(io)

server.listen(PORT, () => {
  console.log(`🧡 Orange server listening on :${PORT} — accepting clients at ${ALLOWED_ORIGINS.join(", ")}`)
  console.log(`   SQLite: ${process.env.DB_PATH || "./data/orange.db"}`)
})
