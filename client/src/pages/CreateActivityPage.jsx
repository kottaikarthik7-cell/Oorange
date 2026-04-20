// Create a new activity. Uses Nominatim (OSM geocoding — no API key) to
// resolve a free-form location into lat/lng. On success, it posts to the server
// which broadcasts `activity:new` to all clients in real time.

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Search, ArrowLeft, Sparkles } from "lucide-react"
import { api } from "../api.js"

const CATEGORIES = [
  { id: "sports",   label: "Sports",   emoji: "⚽", color: "#f97316" },
  { id: "fitness",  label: "Fitness",  emoji: "🧘", color: "#fb923c" },
  { id: "food",     label: "Food",     emoji: "🍕", color: "#c2410c" },
  { id: "social",   label: "Social",   emoji: "☕", color: "#ea580c" },
  { id: "arts",     label: "Arts",     emoji: "🎨", color: "#fdba74" },
  { id: "outdoors", label: "Outdoors", emoji: "🥾", color: "#16a34a" },
  { id: "music",    label: "Music",    emoji: "🎵", color: "#8b5cf6" },
]

export default function CreateActivityPage() {
  const nav = useNavigate()
  const [title, setTitle] = useState("")
  const [desc, setDesc]   = useState("")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [locInput, setLocInput] = useState("")
  const [loc, setLoc] = useState(null) // { label, lat, lng }
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 3 * 3600e3)
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [maxPeople, setMaxPeople] = useState(16)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const searchPlace = async () => {
    if (!locInput.trim()) return
    setSearching(true); setResults([])
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(locInput)}`,
        { headers: { "Accept-Language": "en" } }
      )
      const data = await r.json()
      setResults(data || [])
    } catch {
      setErr("Couldn't search for that address right now.")
    } finally { setSearching(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr("")
    if (!title.trim()) return setErr("Give your activity a title.")
    if (!loc) return setErr("Pick a location from the search results.")
    setBusy(true)
    try {
      const startAt = Math.floor(new Date(when).getTime() / 1000)
      const { activity } = await api.createActivity({
        title, description: desc,
        category: category.id, emoji: category.emoji, color: category.color,
        location: loc.label, lat: loc.lat, lng: loc.lng,
        startAt, maxPeople: Number(maxPeople) || 16,
      })
      nav(`/a/${activity.id}`)
    } catch (e) {
      setErr(e.message || "Couldn't create activity")
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-3 py-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="font-semibold">Create activity</div>
      </header>

      <form onSubmit={submit} className="p-4 space-y-4">
        <Labeled label="Title">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Sunday soccer pickup"
            className="w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </Labeled>

        <Labeled label="Category">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                type="button" key={c.id}
                onClick={() => setCategory(c)}
                className={`px-3 py-2 rounded-xl border text-sm flex items-center gap-1 transition ${
                  category.id === c.id ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-neutral-200 hover:border-orange-300"
                }`}
              >
                <span>{c.emoji}</span>{c.label}
              </button>
            ))}
          </div>
        </Labeled>

        <Labeled label="Description">
          <textarea
            value={desc} onChange={e => setDesc(e.target.value)} rows={3}
            placeholder="What should people expect? What to bring?"
            className="w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 resize-none"
          />
        </Labeled>

        <Labeled label="Location">
          <div className="flex gap-2">
            <input
              value={locInput}
              onChange={e => setLocInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); searchPlace() } }}
              placeholder="Address or landmark"
              className="flex-1 border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
            <button type="button" onClick={searchPlace} disabled={searching} className="px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-sm font-medium">
              {searching ? "…" : <Search className="w-4 h-4" />}
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 border border-neutral-200 rounded-xl overflow-hidden">
              {results.map((r, i) => (
                <button
                  type="button" key={r.place_id || i}
                  onClick={() => {
                    setLoc({ label: r.display_name.split(",").slice(0, 3).join(","),
                             lat: Number(r.lat), lng: Number(r.lon) })
                    setResults([])
                  }}
                  className="w-full text-left p-3 hover:bg-orange-50 border-b last:border-0 border-neutral-100 text-sm flex gap-2"
                >
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <span className="truncate">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
          {loc && (
            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2 text-sm text-orange-900 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="flex-1 truncate">{loc.label}</span>
              <button type="button" onClick={() => setLoc(null)} className="text-xs underline">change</button>
            </div>
          )}
        </Labeled>

        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Starts">
            <input
              type="datetime-local" value={when} onChange={e => setWhen(e.target.value)}
              className="w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </Labeled>
          <Labeled label="Max people">
            <input
              type="number" value={maxPeople} onChange={e => setMaxPeople(e.target.value)} min={2} max={200}
              className="w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </Labeled>
        </div>

        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>}

        <button
          disabled={busy}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> {busy ? "Creating…" : "Post activity"}
        </button>
      </form>
    </div>
  )
}

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-neutral-500 mb-1.5">{label}</span>
      {children}
    </label>
  )
}
