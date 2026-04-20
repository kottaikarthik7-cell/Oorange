// Real map view using Leaflet + CartoDB Voyager tiles. Shows every activity as
// a pin; tapping a pin opens a mini card that links to the activity.
// Also shows the user's own location (geolocation API) as a pulsing blue dot.

import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import L from "leaflet"
import { api } from "../api.js"
import { Navigation, Layers, X } from "lucide-react"

export default function MapPage() {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const pinLayerRef = useRef(null)
  const userMarkerRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const nav = useNavigate()

  // Boot the map once.
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

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Load and plot activities.
  useEffect(() => {
    let dead = false
    async function go() {
      const { activities } = await api.listActivities()
      if (dead || !mapRef.current) return
      pinLayerRef.current.clearLayers()
      activities.forEach(a => {
        if (typeof a.lat !== "number" || typeof a.lng !== "number") return
        const icon = L.divIcon({
          className: "orange-pin",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          html: `<div class="orange-pin-dot" style="background:${a.color};">${a.emoji}</div>`,
        })
        L.marker([a.lat, a.lng], { icon })
          .addTo(pinLayerRef.current)
          .on("click", () => setSelected(a))
      })
    }
    go()
    return () => { dead = true }
  }, [])

  // Try to get the user's location, drop a pulsing dot, center once.
  useEffect(() => {
    if (!navigator.geolocation || !mapRef.current) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
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

  return (
    <div className="relative h-[calc(100vh-80px)]">
      <div ref={ref} className="absolute inset-0" />

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-[400]">
        <button onClick={locateMe} className="w-10 h-10 bg-white rounded-xl shadow grid place-items-center hover:bg-neutral-50">
          <Navigation className="w-5 h-5 text-orange-600" />
        </button>
      </div>

      {/* Selected activity bottom sheet */}
      {selected && (
        <div className="absolute left-3 right-3 bottom-3 bg-white rounded-2xl shadow-lg border border-neutral-200 p-4 z-[400] animate-pop">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl grid place-items-center text-2xl shrink-0"
                 style={{ background: selected.color + "22", color: selected.color }}>{selected.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{selected.title}</div>
              <div className="text-xs text-neutral-500 truncate">{selected.location}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{selected.memberCount} going</div>
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
    </div>
  )
}
