// The user's own profile. Allows editing bio/name/avatar, logging out,
// browsing community, notifications, and calls list.

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"
import Avatar from "../components/Avatar.jsx"
import { Edit3, LogOut, Bell, Users as UsersIcon, Sparkles, MessageSquare } from "lucide-react"

export default function ProfilePage() {
  const { user, logout, patch } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name || "")
  const [bio,  setBio]  = useState(user?.bio || "")
  const [saving, setSaving] = useState(false)
  const nav = useNavigate()

  const save = async () => {
    setSaving(true)
    try { await patch({ name, bio }); setEditing(false) }
    catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  if (!user) return null

  return (
    <div>
      <div className="bg-gradient-to-b from-orange-500 to-orange-400 pt-8 pb-16 px-4 text-white">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={72} className="ring-4 ring-white" />
          <div className="flex-1 min-w-0">
            {editing ? (
              <input value={name} onChange={e => setName(e.target.value)}
                     className="w-full bg-white/20 border border-white/40 rounded-lg px-2 py-1 text-white placeholder-white/60 text-lg font-bold" />
            ) : (
              <div className="text-xl font-bold truncate">{user.name}</div>
            )}
            <div className="text-sm opacity-80">@{user.handle}</div>
          </div>
          <button onClick={() => editing ? save() : setEditing(true)}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold flex items-center gap-1">
            {editing ? (saving ? "…" : "Save") : (<><Edit3 className="w-3 h-3" /> Edit</>)}
          </button>
        </div>

        {editing ? (
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
                    className="mt-4 w-full bg-white/15 border border-white/30 rounded-lg p-2 text-sm placeholder-white/60" />
        ) : (
          <p className="mt-4 text-sm opacity-95">
            {user.bio || "No bio yet — tap edit to add one."}
          </p>
        )}
      </div>

      <div className="-mt-8 px-4 space-y-3">
        <Row onClick={() => nav("/ai")} icon={<Sparkles className="w-4 h-4" />} label="Orange Assistant" sub="Ask AI what to do tonight" />
        <Row onClick={() => nav("/feed")} icon={<MessageSquare className="w-4 h-4" />} label="Community feed" sub="See recent posts" />
        <Row onClick={() => nav("/notifs")} icon={<Bell className="w-4 h-4" />} label="Notifications" sub="Activity & mentions" />
        <Row onClick={() => nav("/home")} icon={<UsersIcon className="w-4 h-4" />} label="Upcoming activities" sub="Things you're going to" />
        <Row onClick={() => nav("/map")} icon={<Sparkles className="w-4 h-4" />} label="Nearby on map" sub="What's happening around you" />
      </div>

      <div className="px-4 mt-4 pb-8">
        <button onClick={() => { if (confirm("Log out?")) logout() }}
                className="w-full bg-white border border-neutral-200 hover:border-red-300 text-red-600 rounded-xl py-3 font-semibold flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  )
}

function Row({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick}
            className="w-full bg-white border border-neutral-200 hover:border-orange-300 rounded-2xl p-4 flex items-center gap-3 text-left transition">
      <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 grid place-items-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-neutral-500">{sub}</div>
      </div>
      <div className="text-neutral-300">›</div>
    </button>
  )
}
