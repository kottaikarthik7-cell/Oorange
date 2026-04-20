// Real map view using Leaflet + CartoDB Voyager tiles. Shows every activity
// as a pin; tapping a pin opens a mini card that links to the activity.
// Also shows the user's own location (geolocation API) as a pulsing blue dot.
//
// Feature parity with HomePage:
//   - Category filter chips (same 8 categories)
//   - Search across title / location / description
//   - Real-time updates via socket (activity:new, activity:member_joined)
//   - Map ↔ List toggle so you can flip between geographic and feed views
//   - Fit-all-pins button (auto-zooms to the currently-filtered set)
//   - "Locate me" centers on the user's current GPS position

import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import L from "leaflet"
import { api } from "../api.js"
import { useAuth } from "../context/AuthContext.jsx"
import { Navigation, Search, X, List, Map as MapIcon, Maximize2, Users, MapPin, Clock } from "lucide-react"

const CATEGORIES = [
  { id: "all",      label: "All",      emoji: "✨" },
  { id: "sports",   label: "Sports",   emoji: "⚽" },
  { id: "fitness",  label: "Fitness",  emoji: "🧘" },
  { id: "food",     label: "Food",     emoji: "🍕" },
  { id: "social",   label: "Social",   emoji: "☕" },
  { id: "arts",     label: "Arts",     emoji: "🎨" },
  { id: "outdoors", label: "Outdoors", emoji: "🥾" },
  { id: "music",    label: "Music",    emoji: "🎵" },
]

export default function MapPage() {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const pinLayerRef = useRef(null)
  const userMarkerRef = useRef(null)
  const { socket } = useAuth()

  const [view, setView]         = useState("map")   // "map" | "list"
  const [category, setCategory] = useState("all")
  const [query, setQuery]       = useState("")
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [userPos, setUserPos]   = useState(null)
  const nav = useNavigate()

  // ---- Boot the map once ---------------------------------------------------
  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = L.map(ref.current, {
      center: [40.748, -73.987],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    })
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map)
    L.control.zoom({ position: "bottomright" }).addTo(map)
    pinLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 100)

    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (view === "map" && mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 50)
    }
  }, [view])

  const load = async () => {
    setLoading(true)
    try {
      const { activities } = await api.listActivities({
        category: category === "all" ? undefined : category,
      })
      setItems(activities)
    } catch (e) {
      console.warn("[map] load failed:", e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [category])

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
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.location?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q)
    )
  }, [items, query])

  useEffect(() => {
    const layer = pinLayerRef.current
    if (!layer) return
    layer.clearLayers()
    visible.forEach(a => {
      if (typeof a.lat !== "number" || typeof a.lng !== "number") return
      const icon = L.divIcon({
        className: "orange-pin",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        html: `<div class="orange-pin-dot" style="background:${a.color || "#f97316"};">${a.emoji || "📍"}</div>`,
      })
      L.marker([a.lat, a.lng], { icon })
        .addTo(layer)
        .on("click", () => setSelected(a))
    })
  }, [visible])

  useEffect(() => {
    if (!navigator.geolocation || !mapRef.current) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserPos([latitude, longitude])
        if (!userMarkerRef.current) {
          const icon = L.divIcon({
            className: "orange-pin",
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            html: '<div class="orange-pin-user"></div>',
          })
          userMarkerRef.current = L.marker([latitude, longitude], { icon }).addTo(mapRef.current)
        } else {
          userMarkerRef.current.setLatLng([latitude, longitude])
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const locateMe = () => {
    const m = userMarkerRef.current
    if (m) mapRef.current.flyTo(m.getLatLng(), 15, { duration: 0.7 })
  }

  const fitAll = () => {
    const pts = visible
      .filter(a => typeof a.lat === "number" && typeof a.lng === "number")
      .map(a => [a.lat, a.lng])
    if (pts.length === 0) return
    if (pts.length === 1) {
      mapRef.current.flyTo(pts[0], 14, { duration: 0.6 })
    } else {
      mapRef.current.flyToBounds(L.latLngBounds(pts), { padding: [40, 40], duration: 0.8 })
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <header className="px-3 pt-3 pb-2 bg-white border-b border-neutral-100 z-10">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute top-2.5 left-3" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search activities or places…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
            <ViewTab active={view === "map"}  onClick={() => setView("map")}  icon={<MapIcon className="w-4 h-4" />} label="Map" />
            <ViewTab active={view === "list"} onClick={() => setView("list")} icon={<List    className="w-4 h-4" />} label="List" />
          </div>
        </div>
        <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs border transition ${
                category === c.id
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-orange-300"
              }`}
            >
              <span className="mr-1">{c.emoji}</span>{c.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-[11px] text-neutral-500">
          {loading ? "Loading…" : `${visible.length} ${visible.length === 1 ? "activity" : "activities"} ${category === "all" ? "" : "in " + CATEGORIES.find(c => c.id === category)?.label.toLowerCase()}`}
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={ref}
          className={`absolute inset-0 ${view === "map" ? "block" : "hidden"}`}
        />

        {view === "map" && (
          <>
            <div className="absolute top-3 right-3 flex flex-col gap-2 z-[400]">
              <IconBtn onClick={fitAll}   title="Fit all pins"><Maximize2  className="w-5 h-5 text-orange-600" /></IconBtn>
              <IconBtn onClick={locateMe} title="Center on me"><Navigation className="w-5 h-5 text-orange-600" /></IconBtn>
            </div>

            {selected && (
              <div className="absolute left-3 right-3 bottom-3 bg-white rounded-2xl shadow-lg border border-neutral-200 p-4 z-[400] animate-pop">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl grid place-items-center text-2xl shrink-0"
                       style={{ background: (selected.color || "#f97316") + "22", color: selected.color || "#f97316" }}>
                    {selected.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{selected.title}</div>
                    <div className="text-xs text-neutral-500 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {selected.location}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {selected.memberCount || 1} going</span>
                      {userPos && typeof selected.lat === "number" && (
                        <span className="flex items-center gap-1">
                          · {distanceLabel(userPos, [selected.lat, selected.lng])}
                        </span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {relativeWhen(selected.startAt)}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-full hover:bg-neutral-100 grid place-items-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => nav(`/a/${selected.id}`)}
                  className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl py-2.5"
                >
                  Open live room →
                </button>
              </div>
            )}
          </>
        )}

        {view === "list" && (
          <div className="absolute inset-0 overflow-y-auto p-3 space-y-2 bg-neutral-50">
            {loading && <div className="text-center text-sm text-neutral-400 py-8">Loading…</div>}
            {!loading && visible.length === 0 && (
              <div className="text-center py-16 text-sm text-neutral-500">
                <div className="text-4xl mb-2">🦗</div>
                No activities match this filter.
              </div>
            )}
            {!loading && visible.map(a => (
              <button
                key={a.id}
                onClick={() => nav(`/a/${a.id}`)}
                className="w-full text-left bg-white border border-neutral-200 hover:border-orange-300 rounded-2xl p-3 flex items-start gap-3 transition"
              >
                <div
                  className="w-11 h-11 rounded-2xl grid place-items-center text-xl shrink-0"
                  style={{ background: (a.color || "#f97316") + "22", color: a.color || "#f97316" }}
                >
                  {a.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-tight truncate">{a.title}</div>
                  <div className="text-xs text-neutral-500 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {a.location}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {a.memberCount || 1}</span>
                    {userPos && typeof a.lat === "number" && (
                      <span>{distanceLabel(userPos, [a.lat, a.lng])}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {relativeWhen(a.startAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function IconBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-10 h-10 bg-white rounded-xl shadow grid place-items-center hover:bg-neutral-50"
    >
      {children}
    </button>
  )
}

function ViewTab({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
        active ? "bg-white text-orange-600 shadow" : "text-neutral-500"
      }`}
    >
      {icon}<span>{label}</span>
    </button>
  )
}

function distanceLabel(a, b) {
  if (!a || !b) return ""
  const toRad = (v) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  const km = 2 * R * Math.asin(Math.sqrt(s))
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

function relativeWhen(unix) {
  if (!unix) return "—"
  const diff = unix - Math.floor(Date.now() / 1000)
  if (diff < 0) return "live"
  const hours = Math.round(diff / 3600)
  if (hours < 1) return `in ${Math.max(1, Math.round(diff / 60))}m`
  if (hours < 24) return `in ${hours}h`
  const days = Math.round(hours / 24)
  return `in ${days}d`
}
