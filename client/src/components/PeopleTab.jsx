// Full list of activity members with presence, role badges, and tap-to-DM.

import { useNavigate } from "react-router-dom"
import Avatar from "./Avatar.jsx"
import { useAuth } from "../context/AuthContext.jsx"

export default function PeopleTab({ members, presence }) {
  const { user } = useAuth()
  const nav = useNavigate()
  return (
    <div className="p-3">
      <div className="text-xs font-bold text-neutral-500 uppercase mb-2">People · {members.length}</div>
      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {members.map(m => (
          <button
            key={m.id}
            onClick={() => m.id === user?.id ? nav("/me") : nav(`/u/${m.id}`)}
            className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 text-left"
          >
            <div className="relative">
              <Avatar user={m} size={40} />
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${presence[m.id] ? "bg-emerald-500" : "bg-neutral-300"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{m.name}</div>
              <div className="text-xs text-neutral-500 truncate">@{m.handle || "user"}</div>
            </div>
            {m.role === "host" && (
              <span className="text-[10px] font-bold text-orange-700 bg-orange-100 rounded-full px-2 py-0.5">HOST</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
