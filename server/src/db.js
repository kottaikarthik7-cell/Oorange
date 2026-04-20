// SQLite schema + query helpers for Orange.
// Uses better-sqlite3 for synchronous, file-backed storage — perfect for single-node dev
// and small-scale deployments. For multi-node prod, swap in Postgres.

import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"

const DB_PATH = process.env.DB_PATH || "./data/orange.db"

// Make sure the data directory exists before opening the DB file.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)
db.pragma("journal_mode = WAL")
db.pragma("foreign_keys = ON")

// Initial schema. All statements are idempotent so this can run on every boot.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    password     TEXT NOT NULL,
    name         TEXT NOT NULL,
    handle       TEXT UNIQUE NOT NULL,
    bio          TEXT DEFAULT '',
    avatar_color TEXT DEFAULT '#f97316',
    avatar_emoji TEXT DEFAULT 'A',
    interests    TEXT DEFAULT '[]',
    verified     INTEGER DEFAULT 0,
    last_seen_at INTEGER,
    created_at   INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    email      TEXT PRIMARY KEY,
    code       TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    created_at  INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (follower_id, target_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id)   REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activities (
    id          TEXT PRIMARY KEY,
    host_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    category    TEXT NOT NULL,
    emoji       TEXT DEFAULT '📍',
    color       TEXT DEFAULT '#f97316',
    location    TEXT NOT NULL,
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    start_at    INTEGER NOT NULL,
    max_people  INTEGER DEFAULT 20,
    status      TEXT DEFAULT 'upcoming', -- upcoming | active | completed | cancelled
    created_at  INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_members (
    activity_id TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    role        TEXT DEFAULT 'member', -- host | cohost | member
    checked_in  INTEGER DEFAULT 0,
    joined_at   INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (activity_id, user_id),
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    text        TEXT NOT NULL,
    reactions   TEXT DEFAULT '{}', -- JSON map emoji -> count
    created_at  INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dms (
    id          TEXT PRIMARY KEY,
    sender_id   TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    text        TEXT NOT NULL,
    read_at     INTEGER,
    created_at  INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS posts (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    activity_id TEXT,
    text        TEXT NOT NULL,
    image_url   TEXT,
    created_at  INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id)     REFERENCES users(id)       ON DELETE CASCADE,
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS post_likes (
    post_id    TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS calls (
    id           TEXT PRIMARY KEY,
    caller_id    TEXT NOT NULL,
    recipient_id TEXT,
    activity_id  TEXT,
    kind         TEXT DEFAULT 'voice', -- voice | video
    duration_sec INTEGER DEFAULT 0,
    status       TEXT DEFAULT 'completed', -- completed | missed | declined
    created_at   INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT DEFAULT '',
    data       TEXT DEFAULT '{}',
    read_at    INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_activity    ON messages(activity_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_dms_pair             ON dms(sender_id, recipient_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_posts_user           ON posts(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_activity_members_u   ON activity_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_activities_time      ON activities(start_at);
`)

// Prepared statements for hot paths
export const stmts = {
  getUserByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  getUserById:    db.prepare("SELECT * FROM users WHERE id = ?"),
  getUserByHandle: db.prepare("SELECT * FROM users WHERE handle = ?"),
  insertUser: db.prepare(`
    INSERT INTO users (id, email, password, name, handle, avatar_color, avatar_emoji)
    VALUES (@id, @email, @password, @name, @handle, @avatar_color, @avatar_emoji)
  `),
  markVerified: db.prepare("UPDATE users SET verified = 1 WHERE id = ?"),
  touchLastSeen: db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?"),

  saveCode: db.prepare(`
    INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
  `),
  getCode: db.prepare("SELECT * FROM verification_codes WHERE email = ?"),
  deleteCode: db.prepare("DELETE FROM verification_codes WHERE email = ?"),

  listActivities: db.prepare(`
    SELECT a.*, u.name AS host_name, u.handle AS host_handle, u.avatar_color AS host_color,
           (SELECT COUNT(*) FROM activity_members m WHERE m.activity_id = a.id) AS member_count
    FROM activities a JOIN users u ON u.id = a.host_id
    ORDER BY a.start_at ASC
  `),
  getActivity: db.prepare(`
    SELECT a.*, u.name AS host_name, u.handle AS host_handle, u.avatar_color AS host_color,
           (SELECT COUNT(*) FROM activity_members m WHERE m.activity_id = a.id) AS member_count
    FROM activities a JOIN users u ON u.id = a.host_id
    WHERE a.id = ?
  `),
  insertActivity: db.prepare(`
    INSERT INTO activities (id, host_id, title, description, category, emoji, color, location, lat, lng, start_at, max_people)
    VALUES (@id, @host_id, @title, @description, @category, @emoji, @color, @location, @lat, @lng, @start_at, @max_people)
  `),
  updateActivityStatus: db.prepare("UPDATE activities SET status = ? WHERE id = ?"),

  getMembers: db.prepare(`
    SELECT u.id, u.name, u.handle, u.avatar_color, u.avatar_emoji, u.last_seen_at,
           m.role, m.checked_in, m.joined_at
    FROM activity_members m JOIN users u ON u.id = m.user_id
    WHERE m.activity_id = ? ORDER BY m.joined_at ASC
  `),
  isMember: db.prepare("SELECT 1 FROM activity_members WHERE activity_id = ? AND user_id = ?"),
  addMember: db.prepare(`
    INSERT INTO activity_members (activity_id, user_id, role) VALUES (?, ?, ?)
    ON CONFLICT(activity_id, user_id) DO NOTHING
  `),
  removeMember: db.prepare("DELETE FROM activity_members WHERE activity_id = ? AND user_id = ?"),
  setCheckedIn: db.prepare("UPDATE activity_members SET checked_in = ? WHERE activity_id = ? AND user_id = ?"),

  insertMessage: db.prepare(`
    INSERT INTO messages (id, activity_id, user_id, text)
    VALUES (@id, @activity_id, @user_id, @text)
  `),
  getMessages: db.prepare(`
    SELECT m.*, u.name, u.handle, u.avatar_color, u.avatar_emoji
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.activity_id = ?
    ORDER BY m.created_at ASC
    LIMIT ?
  `),
  updateReactions: db.prepare("UPDATE messages SET reactions = ? WHERE id = ?"),
  getMessage: db.prepare("SELECT * FROM messages WHERE id = ?"),

  insertDM: db.prepare(`
    INSERT INTO dms (id, sender_id, recipient_id, text) VALUES (@id, @sender_id, @recipient_id, @text)
  `),
  getDMThread: db.prepare(`
    SELECT d.*, u.name, u.handle, u.avatar_color
    FROM dms d JOIN users u ON u.id = d.sender_id
    WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
    ORDER BY d.created_at ASC
    LIMIT ?
  `),
  listDMPartners: db.prepare(`
    SELECT other.id, other.name, other.handle, other.avatar_color, other.avatar_emoji,
           last.text AS last_text, last.created_at AS last_ts
    FROM (
      SELECT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS other_id,
             MAX(created_at) AS max_ts
      FROM dms
      WHERE sender_id = ? OR recipient_id = ?
      GROUP BY other_id
    ) pair
    JOIN users other ON other.id = pair.other_id
    JOIN dms last
      ON ((last.sender_id = ? AND last.recipient_id = pair.other_id)
       OR (last.recipient_id = ? AND last.sender_id  = pair.other_id))
      AND last.created_at = pair.max_ts
    ORDER BY pair.max_ts DESC
  `),

  insertPost: db.prepare(`
    INSERT INTO posts (id, user_id, activity_id, text, image_url)
    VALUES (@id, @user_id, @activity_id, @text, @image_url)
  `),
  listPosts: db.prepare(`
    SELECT p.*, u.name, u.handle, u.avatar_color, u.avatar_emoji,
           (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
           EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked
    FROM posts p JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
    LIMIT ?
  `),
  likePost:   db.prepare("INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)"),
  unlikePost: db.prepare("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?"),

  follow:   db.prepare("INSERT OR IGNORE INTO follows (follower_id, target_id) VALUES (?, ?)"),
  unfollow: db.prepare("DELETE FROM follows WHERE follower_id = ? AND target_id = ?"),
  isFollowing: db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND target_id = ?"),
  countFollowers: db.prepare("SELECT COUNT(*) AS n FROM follows WHERE target_id = ?"),
  countFollowing: db.prepare("SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?"),

  insertCall: db.prepare(`
    INSERT INTO calls (id, caller_id, recipient_id, activity_id, kind, duration_sec, status)
    VALUES (@id, @caller_id, @recipient_id, @activity_id, @kind, @duration_sec, @status)
  `),
  listCallsForUser: db.prepare(`
    SELECT c.*, u1.name AS caller_name, u1.avatar_color AS caller_color,
           u2.name AS recipient_name, u2.avatar_color AS recipient_color
    FROM calls c
    LEFT JOIN users u1 ON u1.id = c.caller_id
    LEFT JOIN users u2 ON u2.id = c.recipient_id
    WHERE c.caller_id = ? OR c.recipient_id = ?
    ORDER BY c.created_at DESC LIMIT ?
  `),

  insertNotification: db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, data)
    VALUES (@id, @user_id, @type, @title, @body, @data)
  `),
  listNotifications: db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  `),
  markNotificationRead: db.prepare("UPDATE notifications SET read_at = unixepoch() WHERE id = ? AND user_id = ?"),
}

// Convenience: strip sensitive fields before sending over the wire.
export function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    handle: u.handle,
    bio: u.bio || "",
    avatarColor: u.avatar_color,
    avatarEmoji: u.avatar_emoji,
    interests: safeParse(u.interests) || [],
    verified: !!u.verified,
    lastSeenAt: u.last_seen_at || null,
    createdAt: u.created_at,
  }
}

export function shapeActivity(a) {
  if (!a) return null
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    category: a.category,
    emoji: a.emoji,
    color: a.color,
    location: a.location,
    lat: a.lat,
    lng: a.lng,
    startAt: a.start_at,
    maxPeople: a.max_people,
    status: a.status,
    memberCount: a.member_count ?? 0,
    host: {
      id: a.host_id,
      name: a.host_name,
      handle: a.host_handle,
      avatarColor: a.host_color,
    },
    createdAt: a.created_at,
  }
}

export function shapeMessage(m) {
  if (!m) return null
  return {
    id: m.id,
    activityId: m.activity_id,
    text: m.text,
    reactions: safeParse(m.reactions) || {},
    createdAt: m.created_at,
    user: {
      id: m.user_id,
      name: m.name,
      handle: m.handle,
      avatarColor: m.avatar_color,
      avatarEmoji: m.avatar_emoji,
    },
  }
}

export function shapePost(p) {
  if (!p) return null
  return {
    id: p.id,
    text: p.text,
    imageUrl: p.image_url,
    activityId: p.activity_id,
    likes: p.likes,
    liked: !!p.liked,
    createdAt: p.created_at,
    user: {
      id: p.user_id,
      name: p.name,
      handle: p.handle,
      avatarColor: p.avatar_color,
      avatarEmoji: p.avatar_emoji,
    },
  }
}

export function safeParse(s) {
  try { return JSON.parse(s) } catch { return null }
}
