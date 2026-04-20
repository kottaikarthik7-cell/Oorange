// Call history. WebRTC signaling itself happens over Socket.IO — this is just the log.

import { Router } from "express"
import { nanoid } from "nanoid"
import { stmts } from "../db.js"
import { authRequired } from "../middleware/authRequired.js"

const router = Router()

// GET /calls
router.get("/", authRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500)
  const rows = stmts.listCallsForUser.all(req.user.id, req.user.id, limit)
  res.json({
    calls: rows.map(c => ({
      id: c.id,
      kind: c.kind,
      duration: c.duration_sec,
      status: c.status,
      createdAt: c.created_at,
      caller: { id: c.caller_id, name: c.caller_name, color: c.caller_color },
      recipient: c.recipient_id ? { id: c.recipient_id, name: c.recipient_name, color: c.recipient_color } : null,
      activityId: c.activity_id,
      direction: c.caller_id === req.user.id ? "outgoing" : "incoming",
    })),
  })
})

// POST /calls — log a finished call
router.post("/", authRequired, (req, res) => {
  const { recipientId = null, activityId = null, kind = "voice", durationSec = 0, status = "completed" } = req.body || {}
  const id = "c_" + nanoid(10)
  stmts.insertCall.run({
    id, caller_id: req.user.id, recipient_id: recipientId,
    activity_id: activityId, kind, duration_sec: durationSec, status,
  })
  res.status(201).json({ id })
})

export default router
