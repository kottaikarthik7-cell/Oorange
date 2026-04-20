// Lightweight AI assistant. Generates canned, context-aware suggestions
// without relying on any external LLM — which means zero API cost and no
// setup. Feel free to swap `answer()` for a call to OpenAI / Anthropic /
// Llama.cpp if you want a real model.

import { Router } from "express"
import { authRequired } from "./middleware/authRequired.js"
import { db } from "./db.js"

const router = Router()

const CANNED = [
  "Here are three ideas I'd try this weekend: 1) Sunrise yoga at Riverside, 2) Coffee crawl in Flatiron, 3) Sunset photowalk in FiDi. Want me to draft a group invite?",
  "For a low-key Saturday with strangers, I'd join a coffee meet — low pressure, quick to bail, great conversation.",
  "If you want active, try Sunday Soccer Pickup — it's at 4pm and almost always has 12+ people.",
  "Want to meet foodies? Pizza Making Night on Thursdays is the highest-rated recurring food meet.",
  "For someone new to the app, I'd start with Board Game Night at The Meeple Café — friendly, easy to join.",
]

function answer(text, activities) {
  const q = (text || "").toLowerCase()

  if (activities?.length) {
    // Simple keyword match against live activities
    const match = activities.find(a =>
      q.includes(a.category) ||
      q.includes((a.title || "").toLowerCase().split(" ")[0]) ||
      (q.includes("food") && a.category === "food") ||
      (q.includes("run") && a.category === "sports") ||
      (q.includes("yoga") && a.category === "fitness")
    )
    if (match) return `Check out "${match.title}" — ${match.description} It's at ${match.location}.`
  }

  if (q.includes("today") || q.includes("tonight")) return "For tonight, Basketball Run at Lincoln Courts (6pm) is a solid pick if you're up for it."
  if (q.includes("nearby") || q.includes("near me")) return "Open the Map tab and tap any orange pin — the closest ones to you appear first."
  if (q.includes("meet") || q.includes("new")) return CANNED[1]
  if (q.includes("weekend")) return CANNED[0]
  if (q.includes("food") || q.includes("dinner")) return CANNED[3]
  if (q.includes("photo") || q.includes("camera")) return "Golden Hour Photowalk is Friday at 5pm — great for beginners."

  // Fallback
  return CANNED[Math.floor(Math.random() * CANNED.length)]
}

router.post("/chat", authRequired, (req, res) => {
  const text = String(req.body?.text || "").slice(0, 800)
  const activities = db.prepare("SELECT id, title, description, category, location FROM activities ORDER BY start_at ASC LIMIT 20").all()
  const reply = answer(text, activities)
  // Tiny latency so the UI "typing" indicator has something to do.
  setTimeout(() => res.json({ reply }), 350)
})

export default router
