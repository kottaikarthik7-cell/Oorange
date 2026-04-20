// Thin fetch wrapper around the Orange REST API.
//
// - Automatically injects the JWT from localStorage.
// - Throws on non-2xx responses with a readable error.
// - Returns already-parsed JSON.

const BASE = import.meta.env.VITE_API_URL || "/api"

function getToken() {
  return localStorage.getItem("orange.token") || ""
}
export function setToken(t) {
  if (t) localStorage.setItem("orange.token", t)
  else   localStorage.removeItem("orange.token")
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const msg = (data && data.error) || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
function safeJson(t) { try { return JSON.parse(t) } catch { return t } }

export const api = {
  // ————— Auth —————
  signup: (payload) => request("POST", "/auth/signup", payload),
  verify: (payload) => request("POST", "/auth/verify", payload),
  resend: (payload) => request("POST", "/auth/resend", payload),
  login:  (payload) => request("POST", "/auth/login",  payload),
  me:     () => request("GET",  "/auth/me"),
  updateMe: (patch) => request("PATCH", "/auth/me", patch),

  // ————— Activities —————
  listActivities: (q = {}) => {
    const qs = new URLSearchParams(
      Object.entries(q).filter(([, v]) => v !== undefined && v !== "")
    ).toString()
    return request("GET", `/activities${qs ? "?" + qs : ""}`)
  },
  getActivity: (id) => request("GET", `/activities/${id}`),
  createActivity: (payload) => request("POST", "/activities", payload),
  joinActivity: (id) => request("POST", `/activities/${id}/join`),
  leaveActivity: (id) => request("POST", `/activities/${id}/leave`),
  checkInActivity: (id, coords) => request("POST", `/activities/${id}/checkin`, coords),

  // ————— Messages —————
  listMessages: (activityId) => request("GET", `/activity/${activityId}/messages`),
  sendMessage: (activityId, text) => request("POST", `/activity/${activityId}/messages`, { text }),
  reactMessage: (messageId, emoji) => request("POST", `/activity/messages/${messageId}/react`, { emoji }),

  // ————— DMs —————
  listDMs: () => request("GET", "/dms"),
  getDMThread: (userId) => request("GET", `/dms/${userId}`),
  sendDM: (userId, text) => request("POST", `/dms/${userId}`, { text }),

  // ————— Community posts —————
  listPosts: () => request("GET", "/posts"),
  createPost: (payload) => request("POST", "/posts", payload),
  likePost: (id) => request("POST", `/posts/${id}/like`),
  unlikePost: (id) => request("DELETE", `/posts/${id}/like`),

  // ————— Users & follow —————
  getUser: (id) => request("GET", `/users/${id}`),
  searchUsers: (q) => request("GET", `/users?q=${encodeURIComponent(q || "")}`),
  follow: (id) => request("POST", `/users/${id}/follow`),
  unfollow: (id) => request("DELETE", `/users/${id}/follow`),

  // ————— Uploads —————
  upload: async (file) => {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch(BASE + "/uploads-api", {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    })
    if (!res.ok) throw new Error("upload_failed")
    return res.json()
  },

  // ————— Calls & notifications —————
  listCalls: () => request("GET", "/calls"),
  logCall: (payload) => request("POST", "/calls", payload),
  listNotifications: () => request("GET", "/notifications"),
  readNotification: (id) => request("POST", `/notifications/${id}/read`),

  // ————— Collab tabs: tasks / notes / polls —————
  listTasks: (activityId) => request("GET", `/activities/${activityId}/tasks`),
  createTask: (activityId, text) => request("POST", `/activities/${activityId}/tasks`, { text }),
  toggleTask: (activityId, taskId, done) => request("POST", `/activities/${activityId}/tasks/${taskId}/toggle`, { done }),
  getNote: (activityId) => request("GET", `/activities/${activityId}/notes`),
  putNote: (activityId, body) => request("PUT", `/activities/${activityId}/notes`, { body }),
  listPolls: (activityId) => request("GET", `/activities/${activityId}/polls`),
  createPoll: (activityId, question, options) => request("POST", `/activities/${activityId}/polls`, { question, options }),
  votePoll: (activityId, pollId, choice) => request("POST", `/activities/${activityId}/polls/${pollId}/vote`, { choice }),

  // ————— AI Assistant —————
  aiChat: (text) => request("POST", "/ai/chat", { text }),
}

export function absolute(url) {
  if (!url) return url
  if (url.startsWith("http")) return url
  const origin = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : ""
  return origin + url
}
