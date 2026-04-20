// Orange Assistant — a lightweight chat UI backed by /ai/chat on the server.
// Suggests activities, answers "what should I do tonight?" etc.

import { useRef, useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Send, Sparkles } from "lucide-react"
import { api } from "../api.js"

const SUGGESTIONS = [
  "What should I do tonight?",
  "Recommend an activity for meeting new people.",
  "Anything fun this weekend?",
  "I'm into photography — any ideas?",
]

export default function AIPage() {
  const [messages, setMessages] = useState([
    { id: "welcome", from: "ai", text: "Hi! I'm Orange's assistant. I can suggest activities around you — try asking me 'what should I do tonight?'" },
  ])
  const [text, setText] = useState("")
  const [typing, setTyping] = useState(false)
  const end = useRef(null)
  const nav = useNavigate()

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }) }, [messages.length, typing])

  const send = async (override) => {
    const body = (override ?? text).trim()
    if (!body) return
    if (!override) setText("")
    const mine = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), from: "me", text: body }
    setMessages(prev => [...prev, mine]); setTyping(true)
    try {
      const { reply } = await api.aiChat(body)
      setMessages(prev => [...prev, { id: String(Date.now()), from: "ai", text: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { id: "err" + Date.now(), from: "ai", text: "Sorry, I couldn't think of anything right now." }])
    } finally { setTyping(false) }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="px-3 py-3 bg-white border-b border-neutral-200 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 grid place-items-center text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <div className="font-semibold text-sm">Orange Assistant</div>
          <div className="text-[11px] text-neutral-500">Here to help you find your people</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-neutral-50">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.from === "me"
                ? "bg-orange-500 text-white rounded-br-md"
                : "bg-white border border-neutral-200 rounded-bl-md"
            }`}>{m.text}</div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-md px-3 py-2 text-sm text-neutral-400">
              Thinking…
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      {messages.length <= 2 && (
        <div className="px-3 py-2 flex gap-2 overflow-x-auto no-scrollbar bg-white border-t border-neutral-100">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
                    className="shrink-0 text-xs border border-orange-200 text-orange-700 bg-orange-50 rounded-full px-3 py-1.5 hover:bg-orange-100">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-neutral-200 bg-white flex gap-2">
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
          rows={1} placeholder="Ask me anything about activities…"
          className="flex-1 resize-none border border-neutral-200 rounded-2xl px-3 py-2 text-sm max-h-32 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        />
        <button onClick={() => send()} disabled={!text.trim()}
                className="w-10 h-10 rounded-full bg-orange-500 text-white disabled:opacity-30 grid place-items-center hover:bg-orange-600">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
