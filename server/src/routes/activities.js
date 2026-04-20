// Activity routes + membership.

import { Router } from "express"
import { nanoid } from "nanoid"
import { stmts, shapeActivity } from "../db.js"
import { authRequired } from "../middleware/authRequired.js"

export default function activitiesRouter(io) {
  const router = Router()

  // GET /activities — list all activities (optionally filter by category/bbox/near).
  router.get("/", (req, res) => {
    const { category, near, radius } = req.query
    let rows = stmts.listActivities.all()
    if (category && category !== "all") rows = rows.filter(a => a.category === category)
    if (near) {
      const [lat, lng] = near.split(",").map(Number)
      const r = Number(radius || 10) // km
      rows = rows.filter(a => haversine(lat, lng, a.lat, a.lng) <= r)
    }
    res.json({ activities: rows.map(shapeActivity) })
  })

  // GET /activities/:id — single activity with members.
  router.get("/:id", (req, res) => {
    const a = stmts.getActivity.get(req.params.id)
    if (!a) return res.status(404).json({ error: "not_found" })
    const members = stmts.getMembers.all(a.id).map(m => ({
      id: m.id, name: m.name, handle: m.handle,
      avatarColor: m.avatar_color, avatarEmoji: m.avatar_emoji,
      role: m.role, checkedIn: !!m.checked_in,
      online: isRecent(m.last_seen_at),
    }))
    res.json({ activity: shapeActivity(a), members })
  })

  // POST /activities — create a new activity.
  router.post("/", authRequired, (req, res) => {
    const {
      title, description = "", category = "social", emoji = "📍", color = "#f97316",
      location, lat, lng, startAt, maxPeople = 20,
    } = req.body || {}
    if (!title || !location || !lat || !lng || !startAt) {
      return res.status(400).json({ error: "missing_fields" })
    }
    const id = "a_" + nanoid(8)
    stmts.insertActivity.run({
      id, host_id: req.user.id, title, description, category, emoji, color,
      location, lat, lng, start_at: startAt, max_people: maxPeople,
    })
    // Host is automatically a member with role 'host'.
    stmts.addMember.run(id, req.user.id, "host")
    const row = stmts.getActivity.get(id)
    const activity = shapeActivity(row)
    io.emit("activity:new", activity)
    res.status(201).json({ activity })
  })

  // POST /activities/:id/join
  router.post("/:id/join", authRequired, (req, res) => {
    const a = stmts.getActivity.get(req.params.id)
    if (!a) return res.status(404).json({ error: "not_found" })
    if ((a.member_count || 0) >= a.max_people) {
      return res.status(409).json({ error: "activity_full" })
    }
    stmts.addMember.run(a.id, req.user.id, "member")
    const next = stmts.getActivity.get(a.id)
    io.to(`activity:${a.id}`).emit("activity:member_joined", {
      activityId: a.id,
      member: { id: req.user.id, name: req.user.name, avatarColor: req.user.avatarColor, role: "member" },
      memberCount: next.member_count,
    })
    res.json({ ok: true, activity: shapeActivity(next) })
  })

  // POST /activities/:id/leave
  router.post("/:id/leave", authRequired, (req, res) => {
    stmts.removeMember.run(req.params.id, req.user.id)
    const next = stmts.getActivity.get(req.params.id)
    if (next) {
      io.to(`activity:${req.params.id}`).emit("activity:member_left", {
        activityId: req.params.id, userId: req.user.id, memberCount: next.member_count,
      })
    }
    res.json({ ok: true })
  })

  // POST /activities/:id/checkin  { lat, lng }
  router.post("/:id/checkin", authRequired, (req, res) => {
    const a = stmts.getActivity.get(req.params.id)
    if (!a) return res.status(404).json({ error: "not_found" })
    const isMem = stmts.isMember.get(a.id, req.user.id)
    if (!isMem) return res.status(403).json({ error: "not_a_member" })
    const { lat, lng } = req.body || {}
    // Geo-fence: within 100m of activity location (skippable in dev).
    if (lat != null && lng != null) {
      const meters = haversine(a.lat, a.lng, lat, lng) * 1000
      if (meters > 100 && process.env.NODE_ENV === "production") {
        return res.status(422).json({ error: "too_far", meters: Math.round(meters) })
      }
    }
    stmts.setCheckedIn.run(1, a.id, req.user.id)
    io.to(`activity:${a.id}`).emit("activity:checkin", {
      activityId: a.id, userId: req.user.id, name: req.user.name,
    })
    res.json({ ok: true })
  })

  return router
}

function haversine(lat1, lng1, lat2, lng2) {
  const toRad = d => (d * Math.PI) / 180
  const R = 6371 // km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isRecent(ts) {
  if (!ts) return false
  return (Math.floor(Date.now() / 1000) - ts) < 120 // online if seen in last 2 min
}
