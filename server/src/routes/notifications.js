import { Router } from "express"
import { stmts, safeParse } from "../db.js"
import { authRequired } from "../middleware/authRequired.js"

const router = Router()

router.get("/", authRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200)
  const rows = stmts.listNotifications.all(req.user.id, limit)
  res.json({
    notifications: rows.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: safeParse(n.data) || {},
      read: !!n.read_at,
      createdAt: n.created_at,
    })),
  })
})

router.post("/:id/read", authRequired, (req, res) => {
  stmts.markNotificationRead.run(req.params.id, req.user.id)
  res.json({ ok: true })
})

export default router
