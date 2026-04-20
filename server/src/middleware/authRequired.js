import { verifyToken } from "../auth.js"
import { stmts, publicUser } from "../db.js"

// Express middleware: extracts JWT from `Authorization: Bearer <token>` and
// loads the user into req.user. 401 if the token is missing or invalid.
export function authRequired(req, res, next) {
  const header = req.headers.authorization || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: "missing_token" })
  const claims = verifyToken(token)
  if (!claims) return res.status(401).json({ error: "invalid_token" })
  const user = stmts.getUserById.get(claims.sub)
  if (!user) return res.status(401).json({ error: "user_not_found" })
  req.user = publicUser(user)
  req.userRaw = user
  next()
}

// Optional variant: populates req.user if token present, but never blocks.
export function authOptional(req, res, next) {
  const header = req.headers.authorization || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  if (!token) return next()
  const claims = verifyToken(token)
  if (!claims) return next()
  const user = stmts.getUserById.get(claims.sub)
  if (user) { req.user = publicUser(user); req.userRaw = user }
  next()
}
