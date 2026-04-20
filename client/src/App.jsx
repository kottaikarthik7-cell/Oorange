// Top-level router + layout. Unauthenticated users see /auth; everyone else
// lands inside the app shell with a bottom tab bar.

import { useEffect, useState } from "react"
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom"
import { Home, Map as MapIcon, MessageCircle, User, Plus, Bell } from "lucide-react"

import { useAuth } from "./context/AuthContext.jsx"
import AuthPage from "./pages/AuthPage.jsx"
import HomePage from "./pages/HomePage.jsx"
import MapPage from "./pages/MapPage.jsx"
import ActivityPage from "./pages/ActivityPage.jsx"
import CreateActivityPage from "./pages/CreateActivityPage.jsx"
import ChatsPage from "./pages/ChatsPage.jsx"
import DMPage from "./pages/DMPage.jsx"
import CommunityPage from "./pages/CommunityPage.jsx"
import ProfilePage from "./pages/ProfilePage.jsx"
import UserProfilePage from "./pages/UserProfilePage.jsx"
import NotificationsPage from "./pages/NotificationsPage.jsx"
import LandingPage from "./pages/LandingPage.jsx"
import AIPage from "./pages/AIPage.jsx"
import ToastStack from "./components/ToastStack.jsx"

function Shell({ children }) {
  const loc = useLocation()
  // Hide nav on the live activity room (full-screen).
  const hideNav = /^\/a\//.test(loc.pathname) || /^\/dm\//.test(loc.pathname) || loc.pathname === "/ai"
  return (
    <div className="min-h-full flex flex-col max-w-md mx-auto bg-white shadow-xl relative">
      <div className={`flex-1 ${hideNav ? "" : "pb-20"}`}>{children}</div>
      {!hideNav && <BottomNav />}
      <ToastStack />
    </div>
  )
}

function BottomNav() {
  const tab = "flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium"
  const active = "text-orange-600"
  const inactive = "text-neutral-400"
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-neutral-200 flex z-40">
      <NavLink to="/home" className={({isActive}) => `${tab} ${isActive?active:inactive}`}>
        <Home className="w-5 h-5" /><span>Home</span>
      </NavLink>
      <NavLink to="/map" className={({isActive}) => `${tab} ${isActive?active:inactive}`}>
        <MapIcon className="w-5 h-5" /><span>Map</span>
      </NavLink>
      <NavLink to="/create" className="flex-1 flex items-center justify-center -mt-4">
        <span className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/40 ring-4 ring-white">
          <Plus className="w-6 h-6" />
        </span>
      </NavLink>
      <NavLink to="/chats" className={({isActive}) => `${tab} ${isActive?active:inactive}`}>
        <MessageCircle className="w-5 h-5" /><span>Chats</span>
      </NavLink>
      <NavLink to="/me" className={({isActive}) => `${tab} ${isActive?active:inactive}`}>
        <User className="w-5 h-5" /><span>Me</span>
      </NavLink>
    </nav>
  )
}

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <SplashLoader />
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function SplashLoader() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white grid place-items-center text-3xl font-black animate-pulse">
          🍊
        </div>
        <div className="text-sm text-neutral-500">Starting Orange…</div>
      </div>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <SplashLoader />

  return (
    <Routes>
      <Route path="/"     element={user ? <Navigate to="/home" replace /> : <LandingPage />} />
      <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <AuthPage />} />

      <Route path="/home"     element={<Protected><Shell><HomePage /></Shell></Protected>} />
      <Route path="/ai"       element={<Protected><Shell><AIPage /></Shell></Protected>} />
      <Route path="/map"      element={<Protected><Shell><MapPage /></Shell></Protected>} />
      <Route path="/create"   element={<Protected><Shell><CreateActivityPage /></Shell></Protected>} />
      <Route path="/chats"    element={<Protected><Shell><ChatsPage /></Shell></Protected>} />
      <Route path="/me"       element={<Protected><Shell><ProfilePage /></Shell></Protected>} />
      <Route path="/feed"     element={<Protected><Shell><CommunityPage /></Shell></Protected>} />
      <Route path="/notifs"   element={<Protected><Shell><NotificationsPage /></Shell></Protected>} />
      <Route path="/u/:id"    element={<Protected><Shell><UserProfilePage /></Shell></Protected>} />

      <Route path="/a/:id"    element={<Protected><Shell><ActivityPage /></Shell></Protected>} />
      <Route path="/dm/:id"   element={<Protected><Shell><DMPage /></Shell></Protected>} />

      <Route path="*" element={<Navigate to={user ? "/home" : "/auth"} replace />} />
    </Routes>
  )
}
