// 1:1 direct messages with real-time delivery. The server emits `dm:new` to the
// recipient and `dm:new:outgoing` back to the sender so both windows stay in sync.

import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Send, Phone, Video } from "lucide-react"
import { api } from "../api.js"
import { useAuth } from "../context/AuthContext.jsx"
import Avatar from "../components/Avatar.jsx"

export default function DMPage() {
  const { id: partnerId } = useParams()
  const { user, socket } = useAuth()
  const [partner, setPartner] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [presence, setPresence] = useState(false)
  const listEnd = useRef(null)
  const nav = useNavigate()

  useEffect(() => {
    let dead = false
    ;(async () => {
      const [{ user: p }, { messages }] = await Promise.all([
        api.getUser(partnerId),
        api.getDMThread(partnerId),
      ])
      if (dead) return
      setPartner(p); setMessages(messages)
    })()
    return () => { dead = true }
  }, [partnerId])

  useEffect(() => { listEnd.current?.scrollIntoView({ behavior: "smooth" }) }, [messages.length])

  useEffect(() => {
    if (!socket) return
    const onIn = (m) => {
      if (m.fromUserId === partnerId || m.toUserId === partnerId) {
        setMessages(prev => [...prev, normalizeIncoming(m, partnerId)])
      }
    }
    const onPresence = (e) => { if (e.userId === partnerId) setPresence(e.online) }
    socket.on("dm:new",          onIn)
    socket.on("dm:new:outgoing", onIn)
    socket.on("presence:update", onPresence)
    socket.emit("presence:query", [partnerId], (r) => setPresence(!!r?.[partnerId]))
    return () => {
      socket.off("dm:new",          onIn)
      socket.off("dm:new:outgoing", onIn)
      socket.off("presence:update", onPresence)
    }
  }, [socket, partnerId])

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setText("")
    try {
      const { message } = await api.sendDM(partnerId, body)
      // outgoing socket echo will append, but avoid duplicate by keying on id
      setMessages(prev => prev.some(m => m.id === message.id) ? prev : [...prev, message])
    } catch (e) { alert("Couldn't send: " + e.message) }
  }

  if (!partner) return <div className="p-8 text-center text-neutral-500">Loading…</div>

  return (
    <div className="flex flex-col h-screen">
      <header className="px-3 py-3 bg-white border-b border-neutral-200 flex items-center gap-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar user={partner} size={38} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{partner.name}</div>
          <div className="text-xs text-neutral-500 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${presence ? "bg-emerald-500" : "bg-neutral-300"}`} />
            {presence ? "Online" : "Offline"}
          </div>
        </div>
        <button className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center text-orange-600" title="Voice call">
          <Phone className="w-4 h-4" />
        </button>
        <button className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center text-orange-600" title="Video call">
          <Video className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-neutral-50">
        {messages.length === 0 && (
          <div className="text-center text-xs text-neutral-400 py-10">Say hi to {partner.name.split(" ")[0]} 👋</div>
        )}
        {messages.map(m => {
          const mine = m.fromMe || m.user?.id === user.id
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                mine ? "bg-orange-500 text-white rounded-br-md" : "bg-white border border-neutral-200 rounded-bl-md"
              }`}>{m.text}</div>
            </div>
          )
        })}
        <div ref={listEnd} />
      </div>

      <div className="p-3 border-t border-neutral-200 bg-white flex gap-2 items-end">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
          rows={1}
          placeholder="Message…"
          className="flex-1 resize-none border border-neutral-200 rounded-2xl px-3 py-2 text-sm max-h-32 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        />
        <button onClick={send} disabled={!text.trim()}
                className="w-10 h-10 rounded-full bg-orange-500 text-white disabled:opacity-30 grid place-items-center hover:bg-orange-600">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function normalizeIncoming(m, partnerId) {
  // `dm:new` and `dm:new:outgoing` both emit a shape like
  // { id, fromUserId, toUserId, text, createdAt } — mark mine based on direction.
  return {
    id: m.id,
    text: m.text,
    createdAt: m.createdAt,
    fromMe: m.toUserId === partnerId, // from me → recipient == partner
  }
}
