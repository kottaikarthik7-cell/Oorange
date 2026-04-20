// Shared to-do list for an activity. Everyone sees the same list, ticks
// propagate live via socket.

import { useEffect, useState } from "react"
import { CheckSquare, Square, Plus } from "lucide-react"
import { api } from "../api.js"
import { useSocket } from "../context/AuthContext.jsx"

export default function TasksTab({ activityId, canEdit }) {
  const [tasks, setTasks] = useState([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const socket = useSocket()

  const load = async () => {
    setLoading(true)
    try { const { tasks } = await api.listTasks(activityId); setTasks(tasks) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [activityId])

  useEffect(() => {
    if (!socket) return
    const onNew = (e) => { if (e.activityId === activityId) setTasks(prev => [...prev, e.task]) }
    const onUpdate = (e) => { if (e.activityId === activityId) setTasks(prev => prev.map(t => t.id === e.taskId ? { ...t, done: e.done } : t)) }
    socket.on("task:new", onNew)
    socket.on("task:update", onUpdate)
    return () => { socket.off("task:new", onNew); socket.off("task:update", onUpdate) }
  }, [socket, activityId])

  const add = async () => {
    const body = text.trim(); if (!body) return
    setText("")
    try { const { task } = await api.createTask(activityId, body); setTasks(prev => prev.some(t => t.id === task.id) ? prev : [...prev, task]) }
    catch (e) { alert(e.message) }
  }
  const toggle = async (t) => {
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: !t.done } : x))
    try { await api.toggleTask(activityId, t.id, !t.done) } catch { /* revert? */ }
  }

  const open = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)

  return (
    <div className="p-3 space-y-4">
      {canEdit && (
        <div className="flex gap-2">
          <input
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
            placeholder="Add a task — bring water, book court…"
            className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
          <button onClick={add} disabled={!text.trim()}
                  className="w-10 h-10 rounded-full bg-orange-500 text-white disabled:opacity-30 grid place-items-center">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && <div className="text-xs text-neutral-400 text-center py-8">Loading…</div>}

      {!loading && open.length === 0 && done.length === 0 && (
        <div className="text-center text-neutral-500 py-10">
          <CheckSquare className="w-8 h-8 text-neutral-300 mx-auto" />
          <div className="text-sm mt-2">No tasks yet. Add the first one!</div>
        </div>
      )}

      {open.length > 0 && (
        <div>
          <div className="text-xs font-bold text-neutral-500 uppercase mb-2">To do · {open.length}</div>
          <ul className="space-y-1">
            {open.map(t => <Task key={t.id} t={t} onToggle={() => toggle(t)} />)}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <div className="text-xs font-bold text-neutral-500 uppercase mb-2">Done · {done.length}</div>
          <ul className="space-y-1">
            {done.map(t => <Task key={t.id} t={t} onToggle={() => toggle(t)} />)}
          </ul>
        </div>
      )}
    </div>
  )
}

function Task({ t, onToggle }) {
  return (
    <li>
      <button onClick={onToggle}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-50 text-left">
        {t.done
          ? <CheckSquare className="w-5 h-5 text-emerald-500 shrink-0" />
          : <Square className="w-5 h-5 text-neutral-400 shrink-0" />}
        <span className={`flex-1 text-sm ${t.done ? "text-neutral-400 line-through" : ""}`}>{t.text}</span>
      </button>
    </li>
  )
}
