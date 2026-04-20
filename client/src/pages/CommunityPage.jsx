// Community feed: simple chronological posts with like-counts and a composer.
// Live-updated via `post:new` and `post:like` socket events.

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Heart, Send, ArrowLeft } from "lucide-react"
import { api, absolute } from "../api.js"
import { useAuth } from "../context/AuthContext.jsx"
import Avatar from "../components/Avatar.jsx"

export default function CommunityPage() {
  const { socket, user } = useAuth()
  const [posts, setPosts] = useState([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  const load = async () => {
    setLoading(true)
    try { const { posts } = await api.listPosts(); setPosts(posts) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!socket) return
    const onNew  = (p) => setPosts(prev => [p, ...prev.filter(x => x.id !== p.id)])
    const onLike = (e) => setPosts(prev => prev.map(p =>
      p.id === e.postId ? { ...p, likes: e.count, liked: e.userId === user?.id ? e.liked : p.liked } : p
    ))
    socket.on("post:new",  onNew)
    socket.on("post:like", onLike)
    return () => {
      socket.off("post:new",  onNew)
      socket.off("post:like", onLike)
    }
  }, [socket, user?.id])

  const submit = async () => {
    const body = text.trim()
    if (!body) return
    setBusy(true)
    try {
      const { post } = await api.createPost({ text: body })
      setText("")
      setPosts(prev => [post, ...prev])
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  const toggleLike = async (p) => {
    try {
      if (p.liked) await api.unlikePost(p.id)
      else         await api.likePost(p.id)
      setPosts(prev => prev.map(x => x.id === p.id ? { ...x, liked: !p.liked, likes: (p.likes || 0) + (p.liked ? -1 : 1) } : x))
    } catch (e) { /* ignore */ }
  }

  return (
    <div>
      <header className="px-4 pt-4 pb-3 bg-white border-b border-neutral-100 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full hover:bg-neutral-100 grid place-items-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="text-xl font-bold">Community</div>
          <div className="text-xs text-neutral-500">Stories from people near you</div>
        </div>
      </header>

      <div className="px-4 py-3 bg-white border-b border-neutral-100">
        <div className="flex gap-2">
          <Avatar user={user} size={36} />
          <textarea
            value={text} onChange={e => setText(e.target.value)} rows={2}
            placeholder="Share something — a recap, a photo, a vibe…"
            className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </div>
        <div className="flex justify-end mt-2">
          <button onClick={submit} disabled={busy || !text.trim()}
                  className="text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-full px-4 py-1.5 font-semibold flex items-center gap-1">
            <Send className="w-3.5 h-3.5" /> Post
          </button>
        </div>
      </div>

      <div className="divide-y divide-neutral-100 bg-white">
        {loading && <div className="py-10 text-center text-sm text-neutral-400">Loading…</div>}
        {!loading && posts.length === 0 && (
          <div className="py-16 text-center text-sm text-neutral-500">No posts yet — be first!</div>
        )}
        {posts.map(p => (
          <div key={p.id} className="px-4 py-4">
            <div className="flex items-center gap-2">
              <Avatar user={p.user} size={36} />
              <div>
                <div className="font-semibold text-sm">{p.user?.name}</div>
                <div className="text-xs text-neutral-500">@{p.user?.handle}</div>
              </div>
            </div>
            <div className="mt-2 text-sm whitespace-pre-wrap">{p.text}</div>
            {p.imageUrl && (
              <img src={absolute(p.imageUrl)} alt=""
                   className="mt-3 rounded-xl w-full object-cover max-h-80 border border-neutral-200" />
            )}
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => toggleLike(p)}
                      className={`flex items-center gap-1 text-xs font-medium ${p.liked ? "text-pink-600" : "text-neutral-500 hover:text-pink-600"}`}>
                <Heart className={`w-4 h-4 ${p.liked ? "fill-current" : ""}`} />
                {p.likes || 0}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
