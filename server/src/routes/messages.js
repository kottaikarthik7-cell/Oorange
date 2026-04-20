// Chat messages for activities + direct messages between users.

import { Router } from "express"
import { nanoid } from "nanoid"
import { stmts, shapeMessage, safeParse } from "../db.js"
import { authRequired } from "../middleware/authRequired.js"

export default function messagesRouter(io) {
  const router = Router()

  // GET /activities/:id/messages?limit=200
  router.get("/activity/:id/messages", authRequired, (req, res) => {
    const limit = Math.min(Number(req.query.limit || 200), 500)
    const rows = stmts.getMessages.all(req.params.id, limit)
    res.json({ messages: rows.map(shapeMessage) })
  })

  // POST /activities/:id/messages { text }
  router.post("/activity/:id/messages", authRequired, (req, res) => {
    const activityId = req.params.id
    const text = (req.body?.text || "").trim()
    if (!text) return res.status(400).json({ error: "empty_message" })
    if (!stmts.isMember.get(activityId, req.user.id)) {
      return res.status(403).json({ error: "not_a_member" })
    }
    const id = "m_" + nanoid(10)
    stmts.insertMessage.run({ id, activity_id: activityId, user_id: req.user.id, text })
    const row = stmts.getMessages.all(activityId, 500).find(m => m.id === id)
    const msg = shapeMessage(row)
    io.to(`activity:${activityId}`).emit("message:new", msg)
    res.status(201).json({ message: msg })
  })

  // POST /activities/messages/:id/react { emoji }
  router.post("/activity/messages/:id/react", authRequired, (req, res) => {
    const emoji = req.body?.emoji
    if (!emoji) return res.status(400).json({ error: "missing_emoji" })
    const m = stmts.getMessage.get(req.params.id)
    if (!m) return res.status(404).json({ error: "not_found" })
    const reactions = safeParse(m.reactions) || {}
    reactions[emoji] = (reactions[emoji] || 0) + 1
    stmts.updateReactions.run(JSON.stringify(reactions), m.id)
    io.to(`activity:${m.activity_id}`).emit("message:reaction", {
      messageId: m.id, reactions,
    })
    res.json({ ok: true, reactions })
  })

  // GET /dms — list threads
  router.get("/dms", authRequired, (req, res) => {
    const rows = stmts.listDMPartners.all(
      req.user.id, req.user.id, req.user.id, req.user.id, req.user.id
    )
    res.json({
      threads: rows.map(r => ({
        id: r.id,
        name: r.name,
        handle: r.handle,
        avatarColor: r.avatar_color,
        avatarEmoji: r.avatar_emoji,
        lastText: r.last_text,
        lastTs: r.last_ts,
      })),
    })
  })

  // GET /dms/:userId
  router.get("/dms/:userId", authRequired, (req, res) => {
    const rows = stmts.getDMThread.all(req.user.id, req.params.userId, req.params.userId, req.user.id, 300)
    res.json({
      messages: rows.map(r => ({
        id: r.id, text: r.text, createdAt: r.created_at,
        fromMe: r.sender_id === req.user.id,
        sender: { id: r.sender_id, name: r.name, avatarColor: r.avatar_color },
      })),
    })
  })

  // POST /dms/:userId  { text }
  router.post("/dms/:userId", authRequired, (req, res) => {
    const text = (req.body?.text || "").trim()
    if (!text) return res.status(400).json({ error: "empty_message" })
    const id = "d_" + nanoid(10)
    stmts.insertDM.run({ id, sender_id: req.user.id, recipient_id: req.params.userId, text })
    const dm = {
      id, text, createdAt: Math.floor(Date.now() / 1000),
      fromMe: true,
      sender: { id: req.user.id, name: req.user.name, avatarColor: req.user.avatarColor },
    }
    io.to(`user:${req.params.userId}`).emit("dm:new", {
      ...dm, fromMe: false,
      sender: { id: req.user.id, name: req.user.name, avatarColor: req.user.avatarColor },
    })
    io.to(`user:${req.user.id}`).emit("dm:new:outgoing", dm)
    res.status(201).json({ message: dm })
  })

  return router
}
