// Home feed: list of upcoming activities filtered by category, with a "Join"
// button that hits the live server. Reacts in real time to `activity:new` and
// `activity:member_joined` events.

import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Search, Sparkles, Bell, Users, MapPin, Clock } from "lucide-react"
import { api } from "../api.js"
import { useAuth } from "../context/AuthContext.jsx"
import Avatar from "../components/Avatar.jsx"

const CATEGORIES = [
  { id: "all",      label: "All",        emoji: "✨" },
  { id: "sports",   label: "Sports",     emoji: "⚽" },
  { id: "fitness",  label: "Fitness",    emoji: "🧘" },
  { id: "food",     label: "Food",       emoji: "🍕" },
  { id: "social",   label: "Social",     emoji: "☕" },
  { id: "arts",     label: "Arts",       emoji: "🎨" },
  { id: "outdoors", label: "Outdoors",   emoji: "🥾" },
  { id: "music",    label: "Music",      emoji: "🎵" },
]

export default function HomePage() {
  const { user, socket } = useAuth()
  const [category, setCategory] = useState("all")
  const [query, setQuery]       = useState("")
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const nav = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const { activities } = await api.listActivities({
        category: category === "all" ? undefined : category,
      })
      setItems(activities)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [category])

  // Live updates
  useEffect(() => {
    if (!socket) return
    const onNew = (a) => setItems(prev => [a, ...prev.filter(x => x.id !== a.id)])
    const onJoin = (e) => setItems(prev => prev.map(x =>
      x.id === e.activityId ? { ...x, memberCount: (x.memberCount || 0) + 1 } : x
    ))
    socket.on("activity:new", onNew)
    socket.on("activity:member_joined", onJoin)
    return () => {
      socket.off("activity:new", onNew)
      socket.off("activity:member_joined", onJoin)
    }
  }, [socket])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(a =>
      !q || a.title.toLowerCase().includes(q) ||
      a.location?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-neutral-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-500">Hey {user?.name?.split(" ")[0] || "friend"} 👋</div>
            <div className="text-xl font-bold">What's happening nearby?</div>
          </div>
          <button onClick={() => nav("/notifs")} className="w-10 h-10 rounded-full bg-neutral-100 grid place-items-center hover:bg-neutral-200">
            <Bell className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 relative">
          <Search className="w-4 h-4 text-neutral-400 absolute top-3 left-3" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search activities, places…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-neutral-100 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-200"
          />
        </div>
      </header>

      {/* Category chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-b border-neutral-100">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition ${
              category === c.id
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-white border-neutral-200 text-neutral-600 hover:border-orange-300"
            }`}
          >
            <span className="mr-1">{c.emoji}</span>{c.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {loading && <SkeletonList />}
        {!loading && visible.length === 0 && <Empty onRefresh={load} />}
        {!loading && visible.map(a => (
          <ActivityCard key={a.id} a={a} onClick={() => nav(`/a/${a.id}`)} />
        ))}
      </div>

      <div className="px-4 pb-4">
        <Link to="/feed" className="block text-center text-sm text-orange-600 font-semibold hover:underline">
          See what the community is up to →
        </Link>
      </div>
    </div>
  )
}

function ActivityCard({ a, onClick }) {
  const when = relativeWhen(a.startAt)
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-neutral-200 hover:border-orange-300 rounded-2xl p-4 transition group"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl grid place-items-center text-2xl shrink-0 shadow-sm"
          style={{ background: a.color + "22", color: a.color }}
        >
          {a.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="font-semibold text-sm leading-tight group-hover:text-orange-600 transition">
                {a.title}
              </div>
              <div className="text-xs text-neutral-500 truncate">Hosted by {a.host?.name}</div>
            </div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">{when}</div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1 min-w-0 truncate"><MapPin className="w-3.5 h-3.5" />{a.location}</span>
            <span className="flex items-center gap-1 shrink-0"><Users className="w-3.5 h-3.5" />{a.memberCount || 1}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

function SkeletonList() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white border border-neutral-100 rounded-2xl p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-12 h-12 bg-neutral-200 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 bg-neutral-200 rounded" />
              <div className="h-3 w-1/2 bg-neutral-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

function Empty({ onRefresh }) {
  return (
    <div className="py-16 text-center space-y-3">
      <div className="text-5xl">🦗</div>
      <div className="text-sm text-neutral-500">Nothing happening here yet. Be the first to post something!</div>
      <button onClick={onRefresh} className="text-sm text-orange-600 font-semibold hover:underline">Refresh</button>
    </div>
  )
}

function relativeWhen(unix) {
  if (!unix) return ""
  const diff = unix - Math.floor(Date.now() / 1000)
  if (diff < 0) return "live"
  const hours = Math.round(diff / 3600)
  if (hours < 1) return `in ${Math.max(1, Math.round(diff / 60))}m`
  if (hours < 24) return `in ${hours}h`
  const days = Math.round(hours / 24)
  return `in ${days}d`
}
