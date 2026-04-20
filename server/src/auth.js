// JWT + bcrypt helpers.

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me"
const TTL = "30d"

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: TTL })
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET) } catch { return null }
}

// Generate a 6-digit verification code.
export function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}
