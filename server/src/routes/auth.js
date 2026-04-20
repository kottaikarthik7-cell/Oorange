// Auth endpoints: signup, verify, login, current user.

import { Router } from "express"
import { nanoid } from "nanoid"
import { stmts, publicUser } from "../db.js"
import { hashPassword, verifyPassword, signToken, genCode } from "../auth.js"
import { authRequired } from "../middleware/authRequired.js"

const router = Router()

function handleFromEmail(email) {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "user" + nanoid(4)
}

function uniqueHandle(base) {
  let h = base
  let i = 0
  while (stmts.getUserByHandle.get(h)) {
    i += 1
    h = base + i
  }
  return h
}

// POST /auth/signup { email, password, name? }
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body || {}
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: "invalid_input" })
  }
  if (stmts.getUserByEmail.get(email)) {
    return res.status(409).json({ error: "email_taken" })
  }
  const id = "u_" + nanoid(10)
  const handle = uniqueHandle(handleFromEmail(email))
  const hashed = await hashPassword(password)
  const fallbackName = name || email.split("@")[0]
  const colorPool = ["#f97316", "#fb923c", "#ea580c", "#c2410c", "#fdba74"]
  stmts.insertUser.run({
    id, email,
    password: hashed,
    name: fallbackName,
    handle,
    avatar_color: colorPool[Math.floor(Math.random() * colorPool.length)],
    avatar_emoji: fallbackName[0].toUpperCase(),
  })
  // Send verification code (printed to stdout for dev; wire real SMTP for prod).
  const code = genCode()
  const expires = Math.floor(Date.now() / 1000) + 10 * 60
  stmts.saveCode.run(email, code, expires)
  console.log(`[orange] 📧 verification code for ${email}: ${code}`)

  const user = stmts.getUserById.get(id)
  const token = signToken({ sub: id })
  res.json({ user: publicUser(user), token, verificationRequired: true })
})

// POST /auth/verify { email, code }
router.post("/verify", (req, res) => {
  const { email, code } = req.body || {}
  const stored = stmts.getCode.get(email)
  const now = Math.floor(Date.now() / 1000)
  // Dev bypass: accept 000000 when NODE_ENV !== production.
  const devBypass = process.env.NODE_ENV !== "production" && code === "000000"
  if (!devBypass) {
    if (!stored || stored.code !== code || stored.expires_at < now) {
      return res.status(400).json({ error: "invalid_or_expired_code" })
    }
  }
  const user = stmts.getUserByEmail.get(email)
  if (!user) return res.status(404).json({ error: "user_not_found" })
  stmts.markVerified.run(user.id)
  stmts.deleteCode.run(email)
  res.json({ ok: true, user: publicUser(stmts.getUserById.get(user.id)) })
})

// POST /auth/resend { email }
router.post("/resend", (req, res) => {
  const { email } = req.body || {}
  if (!stmts.getUserByEmail.get(email)) return res.status(404).json({ error: "user_not_found" })
  const code = genCode()
  stmts.saveCode.run(email, code, Math.floor(Date.now() / 1000) + 10 * 60)
  console.log(`[orange] 📧 verification code for ${email}: ${code}`)
  res.json({ ok: true })
})

// POST /auth/login { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {}
  const u = stmts.getUserByEmail.get(email)
  if (!u) return res.status(401).json({ error: "invalid_credentials" })
  const ok = await verifyPassword(password, u.password)
  if (!ok) return res.status(401).json({ error: "invalid_credentials" })
  const token = signToken({ sub: u.id })
  res.json({ user: publicUser(u), token })
})

// GET /auth/me — returns the current user for the token, or 401.
router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user })
})

// PATCH /auth/me { name?, bio?, interests?, avatarEmoji?, avatarColor? }
router.patch("/me", authRequired, (req, res) => {
  const { name, bio, interests, avatarEmoji, avatarColor } = req.body || {}
  const u = req.userRaw
  const next = {
    name: name ?? u.name,
    bio: bio ?? u.bio,
    interests: interests ? JSON.stringify(interests) : u.interests,
    avatar_emoji: avatarEmoji ?? u.avatar_emoji,
    avatar_color: avatarColor ?? u.avatar_color,
  }
  // Use a one-off update rather than a prepared stmt so all fields are optional.
  req.app.locals.db.prepare(`
    UPDATE users SET name = ?, bio = ?, interests = ?, avatar_emoji = ?, avatar_color = ?
    WHERE id = ?
  `).run(next.name, next.bio, next.interests, next.avatar_emoji, next.avatar_color, u.id)
  res.json({ user: publicUser(req.app.locals.db.prepare("SELECT * FROM users WHERE id = ?").get(u.id)) })
})

export default router
