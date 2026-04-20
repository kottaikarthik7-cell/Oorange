// Shared scratchpad — one text blob per activity. Debounced saves; live
// updates via socket from other members.

import { useEffect, useRef, useState } from "react"
import { api } from "../api.js"
import { useSocket, useAuth } from "../context/AuthContext.jsx"

export default function NotesTab({ activityId, canEdit }) {
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")
  const saveTimer = useRef(null)
  const socket = useSocket()
  const { user } = useAuth()

  useEffect(() => {
    let dead = false
    ;(async () => {
      setLoading(true)
      try {
        const { body } = await api.getNote(activityId)
        if (!dead) setBody(body || "")
      } finally { if (!dead) setLoading(false) }
    })()
    return () => { dead = true }
  }, [activityId])

  useEffect(() => {
    if (!socket) return
    const onUpdate = (e) => {
      if (e.activityId !== activityId) return
      if (e.by === user?.id) return // ignore our own echo
      setBody(e.body)
    }
    socket.on("note:update", onUpdate)
    return () => socket.off("note:update", onUpdate)
  }, [socket, activityId, user?.id])

  const onChange = (v) => {
    setBody(v); setStatus("typing…")
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try { await api.putNote(activityId, v); setStatus("saved") }
      catch { setStatus("offline") }
      setTimeout(() => setStatus(""), 1200)
    }, 600)
  }

  if (loading) return <div className="text-xs text-neutral-400 text-center py-10">Loading…</div>

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="font-bold text-neutral-500 uppercase">Shared notes</span>
        <span className="text-neutral-400">{status}</span>
      </div>
      <textarea
        value={body}
        onChange={e => onChange(e.target.value)}
        disabled={!canEdit}
        rows={14}
        placeholder="Ideas, meeting spot, who's bringing what… everyone can edit."
        className="w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 resize-none bg-white"
      />
    </div>
  )
}
