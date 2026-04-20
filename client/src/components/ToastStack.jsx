// Global toast stack: listens for realtime events (DMs, new members, reactions…)
// and shows a small stack of 3s notifications in the corner.

import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"
import { Bell, MessageCircle, UserPlus, Heart } from "lucide-react"

let uid = 0

export default function ToastStack() {
  const { user, socket } = useAuth()
  const [toasts, setToasts] = useState([])
  const loc = useLocation()
  const nav = useNavigate()

  useEffect(() => {
    if (!socket || !user) return

    const push = (t) => {
      const id = ++uid
      setToasts(x => [...x, { id, ...t }])
      setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), 3800)
    }

    const onDM = (msg) => {
      if (loc.pathname === `/dm/${msg.userId}`) return
      push({
        icon: <MessageCircle className="w-4 h-4" />,
        color: "bg-orange-500",
        title: msg.fromName || "New message",
        body: msg.text,
        onClick: () => nav(`/dm/${msg.fromUserId}`),
      })
    }
    const onMember = (e) => {
      if (e.userId === user.id) return
      push({
        icon: <UserPlus className="w-4 h-4" />,
        color: "bg-emerald-500",
        title: `${e.userName} joined`,
        body: e.activityTitle,
        onClick: () => nav(`/a/${e.activityId}`),
      })
    }
    const onReaction = (e) => {
      if (e.userId === user.id) return
      push({
        icon: <Heart className="w-4 h-4" />,
        color: "bg-pink-500",
        title: `${e.userName} reacted ${e.emoji}`,
        body: "",
        onClick: () => nav(`/a/${e.activityId}`),
      })
    }

    socket.on("dm:new",                 onDM)
    socket.on("activity:member_joined", onMember)
    socket.on("message:reaction",       onReaction)

    return () => {
      socket.off("dm:new",                 onDM)
      socket.off("activity:member_joined", onMember)
      socket.off("message:reaction",       onReaction)
    }
  }, [socket, user, loc.pathname, nav])

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <button
          key={t.id}
          onClick={() => t.onClick?.()}
          className="pointer-events-auto bg-white border border-neutral-200 shadow-lg rounded-xl px-3 py-2 flex items-center gap-3 min-w-[260px] max-w-[340px] animate-pop text-left"
        >
          <span className={`w-7 h-7 rounded-full grid place-items-center text-white ${t.color}`}>{t.icon}</span>
          <span className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{t.title}</div>
            {t.body && <div className="text-xs text-neutral-500 truncate">{t.body}</div>}
          </span>
        </button>
      ))}
    </div>
  )
}
