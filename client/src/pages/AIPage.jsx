import { useRef, useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Send, Sparkles, Mic, MapPin } from "lucide-react"
import { api } from "../api.js"

const SUGGESTIONS = [
  "What should I do tonight?",
  "Find events near me",
  "Fun things this weekend",
  "Outdoor activities nearby",
]

export default function AIPage() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("orange_chat")
    return saved
      ? JSON.parse(saved)
      : [{ id: "welcome", from: "ai", text: "Hi! I can suggest activities near you 👀" }]
  })

  const [text, setText] = useState("")
  const [typing, setTyping] = useState(false)
  const [location, setLocation] = useState(null)
  const [listening, setListening] = useState(false)

  const end = useRef(null)
  const nav = useNavigate()

  // 📍 Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }),
      () => {}
    )
  }, [])

  // 💾 Save chat
  useEffect(() => {
    localStorage.setItem("orange_chat", JSON.stringify(messages))
    end.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  // 🎤 Voice input
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return alert("Voice not supported")

    const recog = new SpeechRecognition()
    recog.start()
    setListening(true)

    recog.onresult = (e) => {
      setText(e.results[0][0].transcript)
      setListening(false)
    }

    recog.onerror = () => setListening(false)
  }

  // 🧠 Send message
  const send = async (override) => {
    const body = (override ?? text).trim()
    if (!body) return

    if (!override) setText("")

    const mine = {
      id: Date.now(),
      from: "me",
      text: body,
      time: new Date().toLocaleTimeString()
    }

    setMessages(prev => [...prev, mine])
    setTyping(true)

    try {
      const { reply } = await api.aiChat({
        message: body,
        location
      })

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          from: "ai",
          text: reply,
          time: new Date().toLocaleTimeString()
        }
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: "err" + Date.now(),
          from: "ai",
          text: "Something went wrong 😅"
        }
      ])
    } finally {
      setTyping(false)
    }
  }

  // 🧩 Parse activity cards (simple AI formatting)
  const renderMessage = (m) => {
    if (m.text.includes("||")) {
      const items = m.text.split("||")
      return items.map((item, i) => (
        <div key={i} className="bg-white border p-2 rounded-xl mt-1">
          <div className="font-semibold">{item}</div>
          <div className="flex gap-2 mt-2">
            <button className="text-xs bg-orange-100 px-2 py-1 rounded">Explore</button>
            <button className="text-xs bg-green-100 px-2 py-1 rounded">Save</button>
          </div>
        </div>
      ))
    }
    return m.text
  }

  return (
    <div className="flex flex-col h-screen">

      {/* HEADER */}
      <header className="px-3 py-3 bg-white border-b flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-9 h-9 rounded-xl bg-orange-500 grid place-items-center text-white">
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="flex-1">
          <div className="font-semibold text-sm">Orange Assistant</div>
          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {location ? "Location enabled" : "Location off"}
          </div>
        </div>
      </header>

      {/* CHAT */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-neutral-50">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              m.from === "me"
                ? "bg-orange-500 text-white"
                : "bg-white border"
            }`}>
              {renderMessage(m)}
              {m.time && <div className="text-[10px] opacity-50 mt-1">{m.time}</div>}
            </div>
          </div>
        ))}

        {typing && (
          <div className="text-sm text-gray-400">Thinking...</div>
        )}

        <div ref={end} />
      </div>

      {/* SUGGESTIONS */}
      {messages.length <= 2 && (
        <div className="px-3 py-2 flex gap-2 overflow-x-auto bg-white">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-xs bg-orange-100 px-3 py-1 rounded-full">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* INPUT */}
      <div className="p-3 border-t flex gap-2 bg-white">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Ask about activities..."
          className="flex-1 border rounded-2xl px-3 py-2 text-sm"
        />

        <button onClick={startVoice}
          className={`w-10 h-10 rounded-full ${listening ? "bg-red-500" : "bg-gray-200"} grid place-items-center`}>
          <Mic className="w-4 h-4" />
        </button>

        <button onClick={() => send()}
          className="w-10 h-10 rounded-full bg-orange-500 text-white grid place-items-center">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
