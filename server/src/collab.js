// Extra collaboration primitives per activity: tasks, notes, polls.
// We add the tables on first import (idempotent) and expose both
// the prepared statements and an Express router factory.

import { Router } from "express"
import { nanoid } from "nanoid"
import { db, stmts } from "./db.js"
import { authRequired } from "./middleware/authRequired.js"

// ————— Schema migration —————
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    assignee_id TEXT,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_activity ON tasks(activity_id);

  CREATE TABLE IF NOT EXISTS notes (
    activity_id TEXT PRIMARY KEY,
    body TEXT NOT NULL DEFAULT '',
    updated_by TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL,     -- JSON array of strings
    closed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_polls_activity ON polls(activity_id);

  CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    choice INTEGER NOT NULL,
    PRIMARY KEY (poll_id, user_id)
  );
`)

const st = {
  // tasks
  listTasks:   db.prepare("SELECT * FROM tasks WHERE activity_id = ? ORDER BY done ASC, created_at ASC"),
  insertTask:  db.prepare("INSERT INTO tasks (id, activity_id, created_by, text) VALUES (@id, @activity_id, @created_by, @text)"),
  toggleTask:  db.prepare("UPDATE tasks SET done = ?, updated_at = strftime('%s','now') WHERE id = ?"),
  deleteTask:  db.prepare("DELETE FROM tasks WHERE id = ? AND created_by = ?"),
  // notes
  getNote:     db.prepare("SELECT * FROM notes WHERE activity_id = ?"),
  upsertNote:  db.prepare(`
    INSERT INTO notes (activity_id, body, updated_by, updated_at)
    VALUES (@activity_id, @body, @updated_by, strftime('%s','now'))
    ON CONFLICT(activity_id) DO UPDATE SET body = @body, updated_by = @updated_by, updated_at = strftime('%s','now')
  `),
  // polls
  listPolls:   db.prepare("SELECT * FROM polls WHERE activity_id = ? ORDER BY created_at DESC"),
  insertPoll:  db.prepare("INSERT INTO polls (id, activity_id, created_by, question, options) VALUES (@id, @activity_id, @created_by, @question, @options)"),
  votesForPoll: db.prepare("SELECT user_id, choice FROM poll_votes WHERE poll_id = ?"),
  castVote:    db.prepare(`
    INSERT INTO poll_votes (poll_id, user_id, choice) VALUES (?, ?, ?)
    ON CONFLICT(poll_id, user_id) DO UPDATE SET choice = excluded.choice
  `),
}

function requireMember(req, res, next) {
  if (!stmts.isMember.get(req.params.id, req.user.id)) {
    return res.status(403).json({ error: "not_a_member" })
  }
  next()
}

function shapePoll(row) {
  const options = JSON.parse(row.options)
  const votes = st.votesForPoll.all(row.id)
  const tallies = options.map((_, i) => votes.filter(v => v.choice === i).length)
  return {
    id: row.id,
    question: row.question,
    options,
    tallies,
    totalVotes: votes.length,
    createdAt: row.created_at,
    closed: !!row.closed,
    voters: Object.fromEntries(votes.map(v => [v.user_id, v.choice])),
  }
}

export default function collabRoutes(io) {
  const r = Router()

  // ——— Tasks ———
  r.get("/:id/tasks", authRequired, requireMember, (req, res) => {
    res.json({ tasks: st.listTasks.all(req.params.id).map(t => ({
      id: t.id, text: t.text, done: !!t.done, createdBy: t.created_by, createdAt: t.created_at,
    })) })
  })
  r.post("/:id/tasks", authRequired, requireMember, (req, res) => {
    const text = (req.body?.text || "").trim()
    if (!text) return res.status(400).json({ error: "empty" })
    const id = "t_" + nanoid(8)
    st.insertTask.run({ id, activity_id: req.params.id, created_by: req.user.id, text })
    const task = { id, text, done: false, createdBy: req.user.id, createdAt: Math.floor(Date.now()/1000) }
    io.to(`activity:${req.params.id}`).emit("task:new", { activityId: req.params.id, task })
    res.status(201).json({ task })
  })
  r.post("/:id/tasks/:taskId/toggle", authRequired, requireMember, (req, res) => {
    const done = req.body?.done ? 1 : 0
    st.toggleTask.run(done, req.params.taskId)
    io.to(`activity:${req.params.id}`).emit("task:update", { activityId: req.params.id, taskId: req.params.taskId, done: !!done })
    res.json({ ok: true })
  })

  // ——— Notes (shared scratchpad) ———
  r.get("/:id/notes", authRequired, requireMember, (req, res) => {
    const row = st.getNote.get(req.params.id)
    res.json({ body: row?.body || "", updatedAt: row?.updated_at || 0 })
  })
  r.put("/:id/notes", authRequired, requireMember, (req, res) => {
    const body = String(req.body?.body || "")
    st.upsertNote.run({ activity_id: req.params.id, body, updated_by: req.user.id })
    io.to(`activity:${req.params.id}`).emit("note:update", { activityId: req.params.id, body, by: req.user.id })
    res.json({ ok: true })
  })

  // ——— Polls ———
  r.get("/:id/polls", authRequired, requireMember, (req, res) => {
    res.json({ polls: st.listPolls.all(req.params.id).map(shapePoll) })
  })
  r.post("/:id/polls", authRequired, requireMember, (req, res) => {
    const question = (req.body?.question || "").trim()
    const options = Array.isArray(req.body?.options) ? req.body.options.map(String).filter(Boolean) : []
    if (!question || options.length < 2) return res.status(400).json({ error: "bad_poll" })
    const id = "pl_" + nanoid(8)
    st.insertPoll.run({ id, activity_id: req.params.id, created_by: req.user.id, question, options: JSON.stringify(options) })
    const poll = shapePoll({ id, activity_id: req.params.id, question, options: JSON.stringify(options), closed: 0, created_at: Math.floor(Date.now()/1000) })
    io.to(`activity:${req.params.id}`).emit("poll:new", { activityId: req.params.id, poll })
    res.status(201).json({ poll })
  })
  r.post("/:id/polls/:pollId/vote", authRequired, requireMember, (req, res) => {
    const choice = Number(req.body?.choice)
    if (!Number.isInteger(choice) || choice < 0) return res.status(400).json({ error: "bad_choice" })
    st.castVote.run(req.params.pollId, req.user.id, choice)
    const row = db.prepare("SELECT * FROM polls WHERE id = ?").get(req.params.pollId)
    const poll = row ? shapePoll(row) : null
    io.to(`activity:${req.params.id}`).emit("poll:update", { activityId: req.params.id, poll })
    res.json({ poll })
  })

  return r
}
