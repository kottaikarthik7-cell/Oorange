// Another user's profile. Follow/unfollow, start DM.

import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, MessageCircle, UserPlus, UserCheck } from "lucide-react"
import { api } from "../api.js"
import { useAuth } from "../context/AuthContext.jsx"
import Avatar from "../components/Avatar.jsx"

export default function UserProfilePage() {
  const { id } = useParams()
  const { user: me } = useAuth()
  const [u, setU] = useState(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  const load = async () => {
    const { user } = await api.getUser(id)
    setU(user)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

  if (!u) return <div className="p-8 text-center text-neutral-500">Loading…</div>
  const itsMe = me?.id === u.id

  const toggleFollow = async () => {
    setBusy(true)
    try {
      if (u.isFollowing) await api.unfollow(u.id)
      else               await api.follow(u.id)
      await load()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <header className="px-3 pt-3 bg-white flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>

      <div className="px-4 py-4 flex items-center gap-4">
        <Avatar user={u} size={72} />
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold truncate">{u.name}</div>
          <div className="text-sm text-neutral-500">@{u.handle}</div>
          <div className="text-xs text-neutral-500 mt-1">
            <b>{u.stats?.followers || 0}</b> followers · <b>{u.stats?.following || 0}</b> following
          </div>
        </div>
      </div>

      {u.bio && <p className="px-4 text-sm text-neutral-700">{u.bio}</p>}

      {!itsMe && (
        <div className="px-4 mt-4 flex gap-2">
          <button onClick={toggleFollow} disabled={busy}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1 transition ${
                    u.isFollowing ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200" : "bg-orange-500 text-white hover:bg-orange-600"
                  }`}>
            {u.isFollowing ? (<><UserCheck className="w-4 h-4" /> Following</>) : (<><UserPlus className="w-4 h-4" /> Follow</>)}
          </button>
          <button onClick={() => nav(`/dm/${u.id}`)}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white border border-neutral-200 hover:border-orange-300 flex items-center justify-center gap-1">
            <MessageCircle className="w-4 h-4" /> Message
          </button>
        </div>
      )}
    </div>
  )
}
