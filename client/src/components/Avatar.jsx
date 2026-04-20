// Tiny orange-themed avatar: a coloured circle with an emoji/letter.
// Accepts either a full user object or the individual fields.

export default function Avatar({ user, size = 40, className = "" }) {
  const color  = user?.avatarColor  || user?.color  || "#f97316"
  const emoji  = user?.avatarEmoji  || user?.emoji  || (user?.name || user?.handle || "?")[0]?.toUpperCase()
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${className}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
    >
      {emoji}
    </div>
  )
}
