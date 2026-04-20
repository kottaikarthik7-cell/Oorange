// In-app notifications list. Marks items read on tap.

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Bell } from "lucide-react"
import { api } from "../api.js"

export default function NotificationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  const load = async () => {
    setLoading(true)
    try { const { notifications } = await api.listNotifications(); setItems(notifications) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const open = async (n) => {
    try { await api.readNotification(n.id) } catch {}
    if (n.data?.activityId) nav(`/a/${n.data.activityId}`)
    else if (n.data?.userId) nav(`/u/${n.data.userId}`)
  }

  return (
    <div>
      <header className="px-3 pt-3 pb-3 bg-white border-b border-neutral-100 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="font-bold text-lg">Notifications</div>
      </header>

      <div className="divide-y divide-neutral-100 bg-white">
        {loading && <div className="py-10 text-center text-neutral-400 text-sm">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="py-16 text-center">
            <Bell className="w-8 h-8 text-neutral-300 mx-auto" />
            <div className="text-sm text-neutral-500 mt-2">You're all caught up.</div>
          </div>
        )}
        {items.map(n => (
          <button key={n.id} onClick={() => open(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-neutral-50 ${!n.read ? "bg-orange-50/50" : ""}`}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{n.title}</div>
                {n.body && <div className="text-xs text-neutral-500 truncate">{n.body}</div>}
              </div>
              {!n.read && <span className="w-2 h-2 bg-orange-500 rounded-full shrink-0" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
