// Combined login + signup + email verification screen.
//
// In development, any 6-digit code works (the server bypasses verification),
// but signup also prints the real code to the server console. The `demo`
// account is pre-seeded — users can click "Try the demo account" to skip signup.

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"

export default function AuthPage() {
  const [mode, setMode] = useState("login")   // login | signup | verify
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const { login, signup, verify } = useAuth()

  const runDemo = async () => {
    setBusy(true); setErr("")
    try {
      await login("demo@orange.dev", "demodemo")
      nav("/home")
    } catch (e) {
      setErr(e.message || "Could not start demo session")
    } finally { setBusy(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr("")
    try {
      if (mode === "login") {
        await login(email, password)
        nav("/home")
      } else if (mode === "signup") {
        await signup({ email, password, name })
        setMode("verify")
      } else if (mode === "verify") {
        await verify(email, code)
        nav("/home")
      }
    } catch (e2) {
      setErr(friendly(e2.message))
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-orange-600 text-white flex flex-col">
      <div className="pt-16 px-6 flex flex-col items-center gap-3">
        <div className="w-16 h-16 bg-white rounded-2xl grid place-items-center text-4xl">🍊</div>
        <div className="text-3xl font-black tracking-tight">Orange</div>
        <div className="text-sm opacity-90 text-center max-w-xs">Real people, right now. Find something to do with the people around you.</div>
      </div>

      <div className="mt-8 flex-1 bg-white text-neutral-900 rounded-t-3xl p-6 pb-28">
        <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-5">
          <Tab label="Log in"  active={mode==="login"}  onClick={() => setMode("login")} />
          <Tab label="Sign up" active={mode==="signup"} onClick={() => setMode("signup")} />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <Field label="Full name" value={name} onChange={setName} placeholder="Alex Rivera" required />
          )}

          {mode !== "verify" && (
            <>
              <Field type="email" label="Email" value={email} onChange={setEmail} placeholder="you@email.com" required />
              <Field type="password" label="Password" value={password} onChange={setPassword} placeholder="Minimum 8 characters" minLength={8} required />
            </>
          )}

          {mode === "verify" && (
            <>
              <div className="text-sm text-neutral-600 bg-orange-50 border border-orange-200 rounded-lg p-3">
                We sent a 6-digit code to <span className="font-semibold">{email}</span>. In development any code works.
              </div>
              <Field label="Verification code" value={code} onChange={setCode} placeholder="000000" maxLength={6} />
            </>
          )}

          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white rounded-xl py-3 font-semibold transition"
          >
            {busy ? "Working…" : mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Verify email"}
          </button>

          {mode !== "verify" && (
            <button
              type="button"
              onClick={runDemo}
              className="w-full border-2 border-orange-200 hover:bg-orange-50 text-orange-600 rounded-xl py-3 font-semibold"
            >
              Try the demo account
            </button>
          )}
        </form>

        <p className="text-xs text-neutral-400 text-center mt-6">
          By using Orange you agree to our (very reasonable) Terms & Privacy.
        </p>
      </div>
    </div>
  )
}

function Tab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${active ? "bg-white text-orange-600 shadow" : "text-neutral-500"}`}
    >
      {label}
    </button>
  )
}

function Field({ label, value, onChange, type = "text", ...rest }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-500 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition"
        {...rest}
      />
    </label>
  )
}

function friendly(msg) {
  if (!msg) return "Something went wrong"
  const map = {
    email_password_required: "Please enter your email and password.",
    invalid_credentials: "That email and password don't match.",
    email_in_use: "An account with that email already exists — try logging in.",
    bad_code: "That code doesn't match. Try again.",
    weak_password: "Passwords must be at least 8 characters.",
  }
  return map[msg] || msg
}
