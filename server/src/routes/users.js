// User profile + follow endpoints.

import { Router } from "express"
import { stmts, publicUser } from "../db.js"
import { authRequired, authOptional } from "../middleware/authRequired.js"

const router = Router()

// GET /users/:id — public profile shape.
router.get("/:id", authOptional, (req, res) => {
  const u = stmts.getUserById.get(req.params.id)
  if (!u) return res.status(404).json({ error: "not_found" })
  const followers = stmts.countFollowers.get(u.id).n
  const following = stmts.countFollowing.get(u.id).n
  let isFollowing = false
  if (req.user) {
    isFollowing = !!stmts.isFollowing.get(req.user.id, u.id)
  }
  res.json({
    user: publicUser(u),
    stats: { followers, following },
    isFollowing,
  })
})

// POST /users/:id/follow
router.post("/:id/follow", authRequired, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "cant_follow_self" })
  stmts.follow.run(req.user.id, req.params.id)
  res.json({ ok: true })
})

// DELETE /users/:id/follow
router.delete("/:id/follow", authRequired, (req, res) => {
  stmts.unfollow.run(req.user.id, req.params.id)
  res.json({ ok: true })
})

// GET /users?q=query — simple search by name/handle.
router.get("/", (req, res) => {
  const q = (req.query.q || "").toLowerCase()
  if (!q) return res.json({ users: [] })
  const rows = req.app.locals.db.prepare(`
    SELECT * FROM users
    WHERE LOWER(name) LIKE ? OR LOWER(handle) LIKE ?
    LIMIT 25
  `).all(`%${q}%`, `%${q}%`)
  res.json({ users: rows.map(publicUser) })
})

export default router
