// Live activity room.
//
// Renders:
//   • Header with title, category emoji, host, join/leave
//   • Live chat (server messages + socket "message:new")
//   • Typing indicator pill
//   • Member strip with online dots
//   • "Check in" button that posts geolocation to the server for geo-fencing
//   • "Share location" toggle that starts emitting `location:update` events
//     so other members see your dot live on their map

import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Send, MapPin, Smile, LogOut, Users, Radar, CheckCircle2, MessageSquare, CheckSquare, FileText, BarChart3 } from "lucide-react"
import { api } from "../api.js"
import { useAuth } from "../context/AuthContext.jsx"
import Avatar from "../components/Avatar.jsx"
import TasksTab  from "../components/TasksTab.jsx"
import NotesTab  from "../components/NotesTab.jsx"
import PollsTab  from "../components/PollsTab.jsx"
import PeopleTab from "../components/PeopleTab.jsx"

const TABS = [
  { id: "chat",   label: "Chat",   icon: MessageSquare },
  { id: "tasks",  label: "Tasks",  icon: CheckSquare },
  { id: "notes",  label: "Notes",  icon: FileText },
  { id: "polls",  label: "Polls",  icon: BarChart3 },
  { id: "people", label: "People", icon: Users },
]

const REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉"]

export default function ActivityPage() {
  const { id } = useParams()
  const { user, socket } = useAuth()
  const nav = useNavigate()
  const [activity, setActivity] = useState(null)
  const [members, setMembers]   = useState([])
  const [messages, setMessages] = useState([])
  const [text, setText]         = useState("")
  const [typingUsers, setTypingUsers] = useState({}) // userId -> name
  const [presence, setPresence] = useState({})       // userId -> bool
  const [sharingLoc, setSharingLoc] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  const [reactionFor, setReactionFor] = useState(null)
  const [tab, setTab] = useState("chat")
  const listEnd = useRef(null)
  const typingTimer = useRef(null)

  const isMember = useMemo(() =>
    members.some(m => m.id === user?.id), [members, user?.id])

  // Load activity + messages.
  useEffect(() => {
    let dead = false
    ;(async () => {
      const { activity } = await api.getActivity(id)
      const { messages } = await api.listMessages(id)
      if (dead) return
      setActivity(activity)
      setMembers(activity.members || [])
      setMessages(messages)
      const pres = {}
      ;(activity.members || []).forEach(m => { pres[m.id] = !!m.online })
      setPresence(pres)
    })()
    return () => { dead = true }
  }, [id])

  // Wire realtime handlers.
  useEffect(() => {
    if (!socket) return
    socket.emit("activity:join_room", id)

    const onMsg = (m) => {
      if (m.activityId !== id) return
      setMessages(prev => [...prev, m])
    }
    const onReact = (e) => {
      if (e.activityId !== id) return
      setMessages(prev => prev.map(m => m.id === e.messageId ? { ...m, reactions: e.reactions } : m))
    }
    const onTyping = ({ activityId, userId, name, typing }) => {
      if (activityId !== id || userId === user.id) return
      setTypingUsers(prev => {
        const next = { ...prev }
        if (typing) next[userId] = name
        else        delete next[userId]
        return next
      })
    }
    const onPresence = ({ userId, online }) => {
      setPresence(prev => ({ ...prev, [userId]: online }))
    }
    const onJoin = (e) => {
      if (e.activityId !== id) return
      setMembers(prev => prev.some(m => m.id === e.userId) ? prev : [...prev, {
        id: e.userId, name: e.userName, avatarColor: e.userColor, role: "member", online: true,
      }])
    }

    socket.on("message:new",              onMsg)
    socket.on("message:reaction",         onReact)
    socket.on("chat:typing",              onTyping)
    socket.on("presence:update",          onPresence)
    socket.on("activity:member_joined",   onJoin)

    return () => {
      socket.emit("activity:leave_room", id)
      socket.off("message:new",             onMsg)
      socket.off("message:reaction",        onReact)
      socket.off("chat:typing",             onTyping)
      socket.off("presence:update",         onPresence)
      socket.off("activity:member_joined",  onJoin)
    }
  }, [socket, id, user?.id])

  // Scroll chat to bottom on new message.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // Live location sharing
  useEffect(() => {
    if (!sharingLoc || !socket) return
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit("location:update", {
          activityId: id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
        })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [sharingLoc, socket, id])

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setText("")
    socket?.emit("chat:typing", { activityId: id, typing: false })
    try {
      await api.sendMessage(id, body)
    } catch (e) {
      alert("Couldn't send message: " + e.message)
    }
  }

  const onType = (v) => {
    setText(v)
    if (!socket) return
    socket.emit("chat:typing", { activityId: id, typing: v.length > 0 })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socket.emit("chat:typing", { activityId: id, typing: false })
    }, 2500)
  }

  const join = async () => {
    try {
      await api.joinActivity(id)
      const { activity } = await api.getActivity(id)
      setActivity(activity); setMembers(activity.members || [])
    } catch (e) { alert(e.message) }
  }
  const leave = async () => {
    if (!confirm("Leave this activity?")) return
    try {
      await api.leaveActivity(id)
      nav("/home")
    } catch (e) { alert(e.message) }
  }

  const checkIn = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not available"); return
    }
    setChecking(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { checkedIn } = await api.checkInActivity(id, {
            lat: pos.coords.latitude, lng: pos.coords.longitude,
          })
          setCheckedIn(!!checkedIn)
        } catch (e) { alert("Check-in failed: " + e.message) }
        finally { setChecking(false) }
      },
      (err) => { setChecking(false); alert("Couldn't get your location: " + err.message) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const react = async (m, emoji) => {
    try {
      const { reactions } = await api.reactMessage(m.id, emoji)
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, reactions } : x))
    } catch (e) { /* silent */ }
    setReactionFor(null)
  }

  if (!activity) return <div className="p-8 text-center text-neutral-500">Loading…</div>

  const typingNames = Object.values(typingUsers)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="px-3 pt-3 pb-2 bg-white border-b border-neutral-200 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div
          className="w-10 h-10 rounded-xl grid place-items-center text-xl"
          style={{ background: activity.color + "22", color: activity.color }}
        >
          {activity.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{activity.title}</div>
          <div className="text-xs text-neutral-500 truncate flex items-center gap-1">
            <Users className="w-3 h-3" /> {members.length} going · {activity.location}
          </div>
        </div>
        {isMember ? (
          <button onClick={leave} className="text-xs text-red-600 border border-red-200 hover:bg-red-50 rounded-full px-3 py-1.5 flex items-center gap-1">
            <LogOut className="w-3 h-3" /> Leave
          </button>
        ) : (
          <button onClick={join} className="text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-full px-3 py-1.5 font-semibold">
            Join
          </button>
        )}
      </header>

      {/* Member strip */}
      <div className="px-3 py-2 bg-white border-b border-neutral-100 flex gap-2 overflow-x-auto no-scrollbar">
        {members.map(m => (
          <div key={m.id} className="relative shrink-0" title={m.name}>
            <Avatar user={m} size={34} />
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${presence[m.id] ? "bg-emerald-500" : "bg-neutral-300"}`} />
          </div>
        ))}
      </div>

      {/* Action row */}
      {isMember && (
        <div className="px-3 py-2 flex gap-2 bg-neutral-50 border-b border-neutral-100">
          <button
            onClick={checkIn}
            disabled={checking || checkedIn}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1 transition ${
              checkedIn ? "bg-emerald-100 text-emerald-700" : "bg-white border border-neutral-200 hover:border-orange-300"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {checkedIn ? "Checked in" : checking ? "Locating…" : "Check in"}
          </button>
          <button
            onClick={() => setSharingLoc(s => !s)}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1 transition ${
              sharingLoc ? "bg-blue-100 text-blue-700" : "bg-white border border-neutral-200 hover:border-orange-300"
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            {sharingLoc ? "Sharing live" : "Share location"}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-neutral-200 bg-white">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${
                active ? "text-orange-600 border-b-2 border-orange-500" : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === "tasks"  && <div className="flex-1 overflow-y-auto bg-neutral-50"><TasksTab  activityId={id} canEdit={isMember} /></div>}
      {tab === "notes"  && <div className="flex-1 overflow-y-auto bg-neutral-50"><NotesTab  activityId={id} canEdit={isMember} /></div>}
      {tab === "polls"  && <div className="flex-1 overflow-y-auto bg-neutral-50"><PollsTab  activityId={id} canEdit={isMember} /></div>}
      {tab === "people" && <div className="flex-1 overflow-y-auto bg-neutral-50"><PeopleTab members={members} presence={presence} /></div>}

      {/* Messages */}
      {tab === "chat" && (<>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-neutral-50">
        {messages.length === 0 && (
          <div className="text-center text-xs text-neutral-400 py-10">
            No messages yet. Say hi 👋
          </div>
        )}
        {messages.map(m => {
          const mine = m.user?.id === user.id
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && <Avatar user={m.user} size={28} />}
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {!mine && <span className="text-[11px] text-neutral-500 mb-0.5 px-1">{m.user?.name}</span>}
                <button
                  onDoubleClick={() => setReactionFor(m.id)}
                  onContextMenu={(e) => { e.preventDefault(); setReactionFor(m.id) }}
                  className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap text-left ${
                    mine ? "bg-orange-500 text-white rounded-br-md" : "bg-white text-neutral-900 rounded-bl-md border border-neutral-200"
                  }`}
                >
                  {m.text}
                </button>
                {m.reactions && Object.keys(m.reactions).length > 0 && (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {Object.entries(m.reactions).map(([emoji, users]) => (
                      <button key={emoji} onClick={() => react(m, emoji)} className="text-xs bg-white border border-neutral-200 rounded-full px-2 py-0.5">
                        {emoji} {users.length}
                      </button>
                    ))}
                  </div>
                )}
                {reactionFor === m.id && (
                  <div className="mt-1 flex gap-1 bg-white rounded-full shadow border border-neutral-200 p-1">
                    {REACTIONS.map(r => (
                      <button key={r} onClick={() => react(m, r)} className="text-lg hover:scale-125 transition">{r}</button>
                    ))}
                    <button onClick={() => setReactionFor(null)} className="px-1 text-neutral-400">✕</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {typingNames.length > 0 && (
          <div className="text-xs text-neutral-500 italic px-1">
            {typingNames.slice(0, 2).join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </div>
        )}
        <div ref={listEnd} />
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-neutral-200 bg-white flex gap-2 items-end">
        <textarea
          value={text}
          onChange={e => onType(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder={isMember ? "Message the group…" : "Join the activity to chat"}
          disabled={!isMember}
          rows={1}
          className="flex-1 resize-none border border-neutral-200 rounded-2xl px-3 py-2 text-sm max-h-32 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        />
        <button
          onClick={send}
          disabled={!isMember || !text.trim()}
          className="w-10 h-10 rounded-full bg-orange-500 text-white disabled:opacity-30 grid place-items-center hover:bg-orange-600 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      </>)}
    </div>
  )
}
