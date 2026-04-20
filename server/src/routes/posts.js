// Community feed posts + likes.

import { Router } from "express"
import { nanoid } from "nanoid"
import { stmts, shapePost } from "../db.js"
import { authRequired, authOptional } from "../middleware/authRequired.js"

export default function postsRouter(io) {
  const router = Router()

  // GET /posts — optional auth so we can tag `liked` per-user.
  router.get("/", authOptional, (req, res) => {
    const uid = req.user?.id || ""
    const limit = Math.min(Number(req.query.limit || 50), 200)
    const rows = stmts.listPosts.all(uid, limit)
    res.json({ posts: rows.map(shapePost) })
  })

  // POST /posts { text, activityId?, imageUrl? }
  router.post("/", authRequired, (req, res) => {
    const { text, activityId = null, imageUrl = null } = req.body || {}
    if (!text || !text.trim()) return res.status(400).json({ error: "empty_post" })
    const id = "p_" + nanoid(10)
    stmts.insertPost.run({ id, user_id: req.user.id, activity_id: activityId, text: text.trim(), image_url: imageUrl })
    const post = stmts.listPosts.all(req.user.id, 500).find(p => p.id === id)
    const shaped = shapePost(post)
    io.emit("post:new", shaped)
    res.status(201).json({ post: shaped })
  })

  // POST /posts/:id/like
  router.post("/:id/like", authRequired, (req, res) => {
    stmts.likePost.run(req.params.id, req.user.id)
    io.emit("post:like", { postId: req.params.id, userId: req.user.id, liked: true })
    res.json({ ok: true })
  })

  // DELETE /posts/:id/like
  router.delete("/:id/like", authRequired, (req, res) => {
    stmts.unlikePost.run(req.params.id, req.user.id)
    io.emit("post:like", { postId: req.params.id, userId: req.user.id, liked: false })
    res.json({ ok: true })
  })

  return router
}
