// Seed demo data: users, activities, memberships, messages, posts.
// Idempotent — run again to add more without duplicating existing rows.

import "dotenv/config"
import { db, stmts } from "./db.js"
import { hashPassword } from "./auth.js"
import { nanoid } from "nanoid"

const NOW = Math.floor(Date.now() / 1000)

const USERS = [
  { handle: "maya",  name: "Maya Patel",     email: "maya@orange.dev",  color: "#f97316", emoji: "M", bio: "Runs weekend soccer · coffee snob · always down for a walk." },
  { handle: "aria",  name: "Aria Nakamura",  email: "aria@orange.dev",  color: "#fb923c", emoji: "A", bio: "Yoga teacher · sunrise enthusiast · dog mom." },
  { handle: "eli",   name: "Eli Martinez",   email: "eli@orange.dev",   color: "#c2410c", emoji: "E", bio: "Pizza night host · pasta sauce obsessive." },
  { handle: "ivy",   name: "Ivy Chen",       email: "ivy@orange.dev",   color: "#fdba74", emoji: "I", bio: "Photography walks · golden hour forever." },
  { handle: "dex",   name: "Dex Rivera",     email: "dex@orange.dev",   color: "#f97316", emoji: "D", bio: "Basketball runs + trivia nights." },
  { handle: "mira",  name: "Mira Shah",      email: "mira@orange.dev",  color: "#fb923c", emoji: "M", bio: "Hiker, painter, plant parent." },
  { handle: "tess",  name: "Tess Williams",  email: "tess@orange.dev",  color: "#ea580c", emoji: "T", bio: "Board game night organizer." },
  { handle: "leo",   name: "Leo Okafor",     email: "leo@orange.dev",   color: "#c2410c", emoji: "L", bio: "Coffee meets and book clubs." },
  { handle: "demo",  name: "Demo User",      email: "demo@orange.dev",  color: "#f97316", emoji: "D", bio: "The default account — try logging in as demo@orange.dev / demodemo." },
]

async function seedUsers() {
  const defaultPassword = await hashPassword("demodemo")
  for (const u of USERS) {
    if (stmts.getUserByEmail.get(u.email)) continue
    stmts.insertUser.run({
      id: "u_" + nanoid(10),
      email: u.email, password: defaultPassword, name: u.name, handle: u.handle,
      avatar_color: u.color, avatar_emoji: u.emoji,
    })
    stmts.markVerified.run(stmts.getUserByEmail.get(u.email).id)
    // Set bio
    db.prepare("UPDATE users SET bio = ? WHERE email = ?").run(u.bio, u.email)
  }
  console.log(`[seed] ${USERS.length} users ensured`)
}

const ACTIVITIES = [
  { title: "Sunday Soccer Pickup", host: "maya", category: "sports",   emoji: "⚽", color: "#f97316",
    lat: 40.7829, lng: -73.9654, location: "Central Park · West Meadow",
    description: "Casual 8v8 pickup game. All skill levels welcome.", dayOffset: 1, hour: 16 },
  { title: "Sunrise Yoga Flow",    host: "aria", category: "fitness",  emoji: "🧘", color: "#fb923c",
    lat: 40.7615, lng: -73.9776, location: "Riverside Greens",
    description: "60-min vinyasa flow by the water. Mats provided.", dayOffset: 2, hour: 6 },
  { title: "Coffee & Conversations", host: "leo",  category: "social",  emoji: "☕", color: "#ea580c",
    lat: 40.7410, lng: -73.9897, location: "Blue Bottle · Flatiron",
    description: "Meet new people over coffee.", dayOffset: 0, hour: 14 },
  { title: "Pizza Making Night",   host: "eli",  category: "food",     emoji: "🍕", color: "#c2410c",
    lat: 40.7308, lng: -74.0020, location: "The Kitchen Lab · West Village",
    description: "Hands-on pizza workshop by a Neapolitan chef.", dayOffset: 4, hour: 19 },
  { title: "Golden Hour Photowalk", host: "ivy",  category: "arts",     emoji: "📸", color: "#fdba74",
    lat: 40.7061, lng: -74.0087, location: "Financial District",
    description: "Bring a camera (phones fine). Wander in golden light.", dayOffset: 5, hour: 17 },
  { title: "Basketball Run",        host: "dex",  category: "sports",   emoji: "🏀", color: "#f97316",
    lat: 40.7580, lng: -73.9855, location: "Lincoln Courts · Midtown",
    description: "5-on-5 full court. Winner stays.", dayOffset: 0, hour: 18 },
  { title: "Sunset Trail Hike",     host: "mira", category: "outdoors", emoji: "🥾", color: "#16a34a",
    lat: 40.7970, lng: -73.9600, location: "Skyline Ridge · Upper West",
    description: "Moderate 4-mile loop with killer sunset view.", dayOffset: 6, hour: 17 },
  { title: "Board Game Night",      host: "tess", category: "social",   emoji: "🎲", color: "#fb923c",
    lat: 40.7413, lng: -74.0038, location: "The Meeple Café · Chelsea",
    description: "Catan, Codenames, Wingspan.", dayOffset: 3, hour: 20 },
]

function seedActivities() {
  // If we already have > 5 activities, skip.
  const existing = db.prepare("SELECT COUNT(*) AS n FROM activities").get().n
  if (existing >= ACTIVITIES.length) {
    console.log(`[seed] ${existing} activities already present — skipping activity seed`)
    return
  }

  const SEC_IN_DAY = 86400
  for (const a of ACTIVITIES) {
    const host = stmts.getUserByHandle.get(a.host)
    if (!host) continue
    const id = "a_" + nanoid(8)
    const startAt = NOW + a.dayOffset * SEC_IN_DAY + (a.hour - 12) * 3600
    stmts.insertActivity.run({
      id, host_id: host.id, title: a.title, description: a.description,
      category: a.category, emoji: a.emoji, color: a.color,
      location: a.location, lat: a.lat, lng: a.lng,
      start_at: startAt, max_people: 16,
    })
    // Host joins as 'host'
    stmts.addMember.run(id, host.id, "host")
    // A few random members
    for (const h of USERS.slice(0, 5)) {
      const u = stmts.getUserByHandle.get(h.handle)
      if (u && u.id !== host.id) stmts.addMember.run(id, u.id, "member")
    }
  }
  console.log(`[seed] ${ACTIVITIES.length} activities ensured`)
}

function seedMessages() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM messages").get().n
  if (existing > 0) return
  const acts = db.prepare("SELECT * FROM activities").all()
  for (const a of acts.slice(0, 3)) {
    const members = stmts.getMembers.all(a.id)
    if (members.length < 2) continue
    const conv = [
      `Hey everyone! Meeting at ${a.location.split("·")[0].trim()} — looking forward!`,
      "On my way, bringing water for the group.",
      "Running 5 min late, sorry!",
      "No worries. I'll hold a spot.",
    ]
    conv.forEach((text, i) => {
      const u = members[i % members.length]
      const id = "m_" + nanoid(10)
      stmts.insertMessage.run({ id, activity_id: a.id, user_id: u.id, text })
    })
  }
  console.log("[seed] seeded chat messages")
}

function seedPosts() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM posts").get().n
  if (existing > 0) return
  const samples = [
    { handle: "maya", text: "Sunday Soccer finally hit 16 players! 🔥 Next week we're doing jersey colors." },
    { handle: "aria", text: "Today's sunrise yoga was magic. 14 strangers, one river, one breath." },
    { handle: "eli",  text: "Pizza night recap: 10 pies, 0 leftovers, 3 new friendships." },
    { handle: "ivy",  text: "Golden hour in FiDi was unreal. Dropping the shots tomorrow." },
  ]
  for (const s of samples) {
    const u = stmts.getUserByHandle.get(s.handle)
    if (!u) continue
    const id = "p_" + nanoid(10)
    stmts.insertPost.run({ id, user_id: u.id, activity_id: null, text: s.text, image_url: null })
  }
  console.log(`[seed] ${samples.length} community posts ensured`)
}

async function main() {
  console.log("[seed] starting…")
  await seedUsers()
  seedActivities()
  seedMessages()
  seedPosts()
  console.log("[seed] done ✓ · demo login: demo@orange.dev / demodemo")
}
main().catch(e => { console.error(e); process.exit(1) })
