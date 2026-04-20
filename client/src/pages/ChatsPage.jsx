// Lists DM threads and the user's activity rooms for quick access.

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"
import { useAuth } from "../context/AuthContext.jsx"
import Avatar from "../components/Avatar.jsx"
import { MessageCircle, Users } from "lucide-react"

export default function ChatsPage() {
  const { user, socket } = useAuth()
  const [dms, setDms] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const [{ threads }, { activities }] = await Promise.all([
        api.listDMs(),
        api.listActivities(),
      ])
      const mine = activities.filter(a => a.members?.some?.(m => m.id === user.id) || a.host?.id === user.id)
      setDms(threads); setActivities(mine.length ? mine : activities.slice(0, 3))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  // Refresh on new DM
  useEffect(() => {
    if (!socket) return
    const refresh = () => load()
    socket.on("dm:new", refresh)
    socket.on("dm:new:outgoing", refresh)
    return () => {
      socket.off("dm:new", refresh)
      socket.off("dm:new:outgoing", refresh)
    }
  }, [socket])

  return (
    <div>
      <header className="px-4 pt-4 pb-3 bg-white border-b border-neutral-100">
        <div className="text-2xl font-bold">Chats</div>
        <div className="text-xs text-neutral-500">Your conversations and activity rooms</div>
      </header>

      <Section title="Direct messages" icon={<MessageCircle className="w-4 h-4" />}>
        {loading && <div className="text-sm text-neutral-400 py-6 text-center">Loading…</div>}
        {!loading && dms.length === 0 && (
          <div className="text-sm text-neutral-500 py-6 text-center">
            No DMs yet. Tap someone's profile in an activity to start a chat.
          </div>
        )}
        {dms.map(t => (
          <button key={t.partner.id} onClick={() => nav(`/dm/${t.partner.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 border-b border-neutral-100 text-left">
            <Avatar user={t.partner} size={44} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <div className="font-semibold text-sm truncate">{t.partner.name}</div>
                <div className="text-[11px] text-neutral-400 ml-auto shrink-0">
                  {relative(t.lastAt)}
                </div>
              </div>
              <div className="text-xs text-neutral-500 truncate">
                {t.lastFromMe ? "You: " : ""}{t.lastText}
              </div>
            </div>
          </button>
        ))}
      </Section>

      <Section title="Activity rooms" icon={<Users className="w-4 h-4" />}>
        {activities.slice(0, 8).map(a => (
          <button key={a.id} onClick={() => nav(`/a/${a.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 border-b border-neutral-100 text-left">
            <div className="w-11 h-11 rounded-xl grid place-items-center text-xl"
                 style={{ background: a.color + "22", color: a.color }}>{a.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{a.title}</div>
              <div className="text-xs text-neutral-500 truncate">{a.memberCount} members · {a.location}</div>
            </div>
          </button>
        ))}
      </Section>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-white">
      <div className="px-4 pt-4 pb-1 text-xs font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
        {icon} {title}
      </div>
      {children}
    </div>
  )
}

function relative(unix) {
  if (!unix) return ""
  const diff = Math.floor(Date.now() / 1000) - unix
  if (diff < 60) return "now"
  if (diff < 3600) return `${Math.round(diff / 60)}m`
  if (diff < 86400) return `${Math.round(diff / 3600)}h`
  return `${Math.round(diff / 86400)}d`
}
