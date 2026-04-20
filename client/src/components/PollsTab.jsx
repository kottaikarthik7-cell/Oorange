// Group polls — anyone creates a 2-6 option poll, members vote,
// live tally updates via socket.

import { useEffect, useState } from "react"
import { api } from "../api.js"
import { useSocket, useAuth } from "../context/AuthContext.jsx"
import { Plus, BarChart3, X } from "lucide-react"

export default function PollsTab({ activityId, canEdit }) {
  const socket = useSocket()
  const { user } = useAuth()
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const { polls } = await api.listPolls(activityId); setPolls(polls) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [activityId])

  useEffect(() => {
    if (!socket) return
    const onNew = (e) => { if (e.activityId === activityId) setPolls(prev => [e.poll, ...prev]) }
    const onUp  = (e) => { if (e.activityId === activityId) setPolls(prev => prev.map(p => p.id === e.poll.id ? e.poll : p)) }
    socket.on("poll:new", onNew)
    socket.on("poll:update", onUp)
    return () => { socket.off("poll:new", onNew); socket.off("poll:update", onUp) }
  }, [socket, activityId])

  const vote = async (poll, i) => {
    // optimistic
    setPolls(prev => prev.map(p => p.id === poll.id ? {
      ...p,
      voters: { ...p.voters, [user.id]: i },
    } : p))
    try { await api.votePoll(activityId, poll.id, i) } catch { /* ignore */ }
  }

  return (
    <div className="p-3 space-y-3">
      {canEdit && !composing && (
        <button onClick={() => setComposing(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-neutral-300 hover:border-orange-300 text-sm text-neutral-500 flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" /> Start a new poll
        </button>
      )}
      {composing && <Composer onCancel={() => setComposing(false)}
                              onCreate={async (q, opts) => {
                                try { await api.createPoll(activityId, q, opts); setComposing(false); load() }
                                catch (e) { alert(e.message) }
                              }} />}

      {loading && <div className="text-xs text-neutral-400 text-center py-8">Loading…</div>}

      {!loading && polls.length === 0 && !composing && (
        <div className="text-center text-neutral-500 py-10">
          <BarChart3 className="w-8 h-8 text-neutral-300 mx-auto" />
          <div className="text-sm mt-2">No polls yet. Settle a decision with one!</div>
        </div>
      )}

      {polls.map(p => <Poll key={p.id} poll={p} myVote={p.voters?.[user?.id]} onVote={(i) => vote(p, i)} />)}
    </div>
  )
}

function Composer({ onCancel, onCreate }) {
  const [q, setQ] = useState("")
  const [opts, setOpts] = useState(["", ""])
  const setOpt = (i, v) => setOpts(prev => prev.map((x, idx) => idx === i ? v : x))
  const addOpt = () => setOpts(prev => prev.length < 6 ? [...prev, ""] : prev)
  const removeOpt = (i) => setOpts(prev => prev.filter((_, idx) => idx !== i))

  const submit = () => {
    const filled = opts.map(o => o.trim()).filter(Boolean)
    if (!q.trim() || filled.length < 2) return alert("Need a question and at least 2 options.")
    onCreate(q.trim(), filled)
  }

  return (
    <div className="border border-neutral-200 rounded-xl p-3 space-y-2 bg-white">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="What's the question?"
             className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
      {opts.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input value={o} onChange={e => setOpt(i, e.target.value)} placeholder={`Option ${i+1}`}
                 className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
          {opts.length > 2 && (
            <button onClick={() => removeOpt(i)} className="w-9 h-9 rounded-lg hover:bg-neutral-100 grid place-items-center text-neutral-500">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button onClick={addOpt} disabled={opts.length >= 6} className="text-xs text-orange-600 font-semibold disabled:opacity-40">
          + add option
        </button>
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-xs rounded-full px-3 py-1.5 hover:bg-neutral-100">Cancel</button>
          <button onClick={submit} className="text-xs rounded-full px-3 py-1.5 bg-orange-500 text-white hover:bg-orange-600 font-semibold">Create</button>
        </div>
      </div>
    </div>
  )
}

function Poll({ poll, myVote, onVote }) {
  const voted = myVote != null
  const total = poll.totalVotes || 0
  return (
    <div className="border border-neutral-200 rounded-xl p-3 bg-white">
      <div className="text-sm font-semibold mb-2">{poll.question}</div>
      <div className="space-y-1.5">
        {poll.options.map((o, i) => {
          const count = poll.tallies?.[i] || 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const mine = myVote === i
          return (
            <button key={i} onClick={() => onVote(i)}
                    className={`relative w-full text-left rounded-lg overflow-hidden border transition ${mine ? "border-orange-500 bg-orange-50" : "border-neutral-200 hover:border-orange-300"}`}>
              <div className="absolute inset-y-0 left-0 bg-orange-200/40" style={{ width: `${voted ? pct : 0}%`, transition: "width .3s" }} />
              <div className="relative flex items-center justify-between px-3 py-2 text-sm">
                <span>{o}</span>
                {voted && <span className="text-xs text-neutral-500">{pct}%</span>}
              </div>
            </button>
          )
        })}
      </div>
      <div className="text-[11px] text-neutral-400 mt-2">{total} vote{total === 1 ? "" : "s"}</div>
    </div>
  )
}
