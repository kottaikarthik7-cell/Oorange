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
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173"
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./data/uploads"
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const app = express()
app.locals.db = db

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }))
app.use(express.json({ limit: "2mb" }))
app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)))

// Healthcheck
app.get("/health", (_, res) => res.json({ ok: true, ts: Date.now() }))

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
})
io.app = app // makes db / locals reachable from realtime module

app.use("/auth", authRoutes)
app.use("/activities", activitiesRoutes(io))
app.use("/", messagesRoutes(io)) // mounts /activity/:id/messages and /dms/*
app.use("/posts", postsRoutes(io))
app.use("/users", usersRoutes)
app.use("/uploads-api", uploadsRoutes) // POST endpoint — distinct from static /uploads
app.use("/calls", callsRoutes)
app.use("/notifications", notificationsRoutes)
app.use("/activities", collabRoutes(io)) // /:id/tasks, /:id/notes, /:id/polls
app.use("/ai", aiRoutes)

app.use((err, _, res, __) => {
  console.error("[orange] error:", err)
  res.status(500).json({ error: err.message || "server_error" })
})

wireRealtime(io)

server.listen(PORT, () => {
  console.log(`🧡 Orange server listening on :${PORT} — accepting clients at ${CLIENT_ORIGIN}`)
  console.log(`   SQLite: ${process.env.DB_PATH || "./data/orange.db"}`)
})
