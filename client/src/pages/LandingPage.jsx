// Marketing splash for people who hit the root URL logged out.
// 3 short value props + a "get started" CTA that routes to /auth.

import { Link } from "react-router-dom"
import { MapPin, MessageCircle, Users } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 via-orange-500 to-orange-600 text-white">
      <div className="max-w-md mx-auto px-6 pt-16 pb-10 flex flex-col min-h-screen">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-2xl grid place-items-center text-3xl">🍊</div>
          <div className="text-2xl font-black tracking-tight">Orange</div>
        </div>

        <div className="mt-16 space-y-4">
          <h1 className="text-4xl font-black leading-tight">Real people.<br />Right now.</h1>
          <p className="text-lg opacity-90">
            Find something to do with real humans around you — coffee, pickup
            games, photowalks, pizza nights. All in real time.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          <Feature icon={<MapPin className="w-5 h-5" />} title="See what's nearby" body="Activities pinned on a real map, updated live." />
          <Feature icon={<MessageCircle className="w-5 h-5" />} title="Chat instantly" body="Group rooms with reactions, typing indicators, and live location." />
          <Feature icon={<Users className="w-5 h-5" />} title="Show up with confidence" body="Check-in on arrival with a 100m geofence. No more flaky plans." />
        </div>

        <div className="flex-1" />

        <Link to="/auth"
              className="block text-center bg-white text-orange-600 rounded-full py-4 font-bold text-lg hover:bg-orange-50 active:bg-orange-100 transition mt-8">
          Get started →
        </Link>
        <p className="text-center text-xs opacity-75 mt-3">Free · no credit card · demo account included</p>
      </div>
    </div>
  )
}

function Feature({ icon, title, body }) {
  return (
    <div className="flex gap-3 bg-white/10 rounded-2xl p-3 backdrop-blur">
      <div className="w-10 h-10 bg-white/20 rounded-xl grid place-items-center shrink-0">{icon}</div>
      <div>
        <div className="font-bold">{title}</div>
        <div className="text-sm opacity-90">{body}</div>
      </div>
    </div>
  )
}
