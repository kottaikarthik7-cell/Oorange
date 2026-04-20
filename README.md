# Orange — real people, right now

Orange is a real-time, location-based social activity app. Post or find a thing
to do near you (coffee, soccer, photowalk, pizza night, board games…), join a
live chat room with the other attendees, share your live location while you
head over, and check in on arrival via a 100-metre geofence.

This repo is a **complete full-stack app**, not a demo: a Node/Express + SQLite
+ Socket.IO backend and a Vite React + Leaflet frontend, plus a single
`docker compose up` deploy.

## What's in the box

```
orange/
├── server/                Node 20 + Express + better-sqlite3 + Socket.IO
│   ├── src/
│   │   ├── index.js       HTTP + socket bootstrap
│   │   ├── db.js          SQLite schema and prepared statements
│   │   ├── auth.js        JWT + bcrypt helpers
│   │   ├── realtime.js    Socket.IO: presence, typing, location, WebRTC relay
│   │   ├── middleware/
│   │   └── routes/        auth, activities, messages, posts, users, uploads, calls, notifications
│   ├── seed.js            Seeds 9 users, 8 activities, sample posts & chats
│   ├── package.json
│   └── Dockerfile
├── client/                Vite React SPA
│   ├── src/
│   │   ├── main.jsx       Router + providers
│   │   ├── App.jsx        Routes + bottom-nav shell
│   │   ├── api.js         REST fetch wrapper with JWT
│   │   ├── socket.js      Socket.IO client singleton
│   │   ├── context/       AuthContext (session + socket lifecycle)
│   │   ├── components/    Avatar, ToastStack
│   │   └── pages/         Auth, Home, Map, Activity (live room), Create,
│   │                       Chats, DM, Community, Profile, UserProfile, Notifications
│   ├── vite.config.js     Dev proxy to :4000
│   ├── nginx.conf         Prod reverse-proxy config
│   ├── Dockerfile         Multi-stage nginx build
│   └── package.json
├── docker-compose.yml     One command prod-like stack
└── README.md              (this file)
```

## Features

- **Auth** — email + password signup, 6-digit email verification (dev bypass),
  JWT sessions with 30-day TTL.
- **Activities** — create with real geocoded location (Nominatim / OSM), list,
  filter by category, join / leave, check-in (100m geofence in production).
- **Live activity room** — group chat with emoji reactions, typing indicators,
  member presence dots, one-tap check-in, and an optional "share my live
  location" toggle that streams your coords to the rest of the room.
- **Direct messages** — 1:1 threads, delivered over Socket.IO in real time,
  with online/offline status.
- **Community feed** — text posts with likes, updating live.
- **Real map** — Leaflet + CartoDB Voyager tiles + OSM, no API key required.
  Your own location shows as a pulsing blue dot; pins for every activity.
- **WebRTC signaling relay** — the server already relays `offer`/`answer`/`ice`
  events over Socket.IO so the client can layer voice/video calls on top.
- **Toast notifications** — in-app toasts for new DMs, activity joins, and
  reactions while you're using the app.

## Running locally

### Prereqs
- Node 20+
- (optional) Docker Desktop if you want the one-command path

### One command (recommended)

```bash
cp server/.env.example server/.env
# edit server/.env to set a real JWT_SECRET
docker compose up --build
```

Then open <http://localhost:8080>. The server auto-seeds on first boot.
Log in with **demo@orange.dev / demodemo** or sign up fresh.

### Manual (two terminals)

```bash
# terminal 1 — backend
cd server
cp .env.example .env
npm install
npm run seed     # one-time seed
npm run dev      # nodemon on :4000
```

```bash
# terminal 2 — frontend
cd client
cp .env.example .env
npm install
npm run dev      # Vite on :5173 (proxies /api + /socket.io to :4000)
```

Visit <http://localhost:5173>.

## Environment

### `server/.env`

| Key            | Example                             | Notes                                              |
|----------------|-------------------------------------|----------------------------------------------------|
| `PORT`         | `4000`                              | HTTP port                                          |
| `JWT_SECRET`   | `change-me-long-random-string`      | **Must set** in production                         |
| `CLIENT_ORIGIN`| `http://localhost:5173`             | Used for CORS — match your deployed frontend URL   |
| `DB_PATH`      | `./data/orange.db`                  | SQLite file (auto-created)                         |
| `UPLOAD_DIR`   | `./data/uploads`                    | Image uploads go here                              |
| `NODE_ENV`     | `development` / `production`        | Dev bypasses email verification & geofence checks  |

### `client/.env`

| Key                | Example                         | Notes                                        |
|--------------------|---------------------------------|----------------------------------------------|
| `VITE_API_URL`     | (blank in dev)                  | Blank → uses Vite proxy → `:4000`            |
| `VITE_SOCKET_URL`  | (blank in dev)                  | Blank → same origin as the page              |

## Deploying

### Fly.io

1. `fly launch` in `server/` — choose a region, decline the Postgres prompt, let
   it read the `Dockerfile`, **mount a volume at `/app/data`** so your SQLite
   file and uploads survive deploys.
2. `fly secrets set JWT_SECRET=<random> CLIENT_ORIGIN=https://orange.fly.dev`
3. `fly deploy`
4. For the client, either deploy with nginx on Fly (`fly launch` in `client/`)
   or push the `dist/` folder to Vercel / Netlify with the two `VITE_*` envs
   pointing at the server URL.

### Railway / Render

Both support **Dockerfile-native** services. Create one service for
`server/` and another for `client/`. In `client`'s env set
`VITE_API_URL` and `VITE_SOCKET_URL` to your server's public URL. Add a
persistent volume for the server at `/app/data`.

### VPS

```bash
git clone ... /opt/orange && cd /opt/orange
cp server/.env.example server/.env      # set JWT_SECRET + public origin
docker compose up -d --build
```

Put it behind a reverse proxy with HTTPS (Caddy is easiest):

```caddyfile
orange.example.com {
  reverse_proxy localhost:8080
}
```

## API cheat-sheet

All endpoints return JSON. Auth endpoints issue `{ token, user }`; everything
else expects `Authorization: Bearer <token>`.

- `POST /auth/signup {email,password,name}` → `{ userId, needsVerification }`
- `POST /auth/verify {email,code}`           → `{ token, user }`
- `POST /auth/login {email,password}`        → `{ token, user }`
- `GET  /auth/me`                            → `{ user }`
- `GET  /activities?category=…&near=lat,lng` → `{ activities }`
- `POST /activities` (title, description, category, emoji, color, location, lat, lng, startAt, maxPeople)
- `POST /activities/:id/join|leave|checkin`
- `GET  /activity/:id/messages`, `POST /activity/:id/messages {text}`
- `GET  /dms`, `GET /dms/:userId`, `POST /dms/:userId {text}`
- `GET  /posts`, `POST /posts {text, imageUrl?}`, `POST /posts/:id/like`, `DELETE /posts/:id/like`
- `GET  /users/:id`, `POST /users/:id/follow`, `DELETE /users/:id/follow`
- `POST /uploads-api` (multipart image)      → `{ url }`
- `GET  /notifications`, `POST /notifications/:id/read`
- `GET  /calls`, `POST /calls`

## Socket.IO events

Client → server:
- `activity:join_room` / `activity:leave_room`
- `chat:typing { activityId, typing }`
- `location:update { activityId, lat, lng, heading }`
- `presence:query [ids]` (ack)
- `call:offer | call:answer | call:ice | call:end`

Server → client:
- `presence:update { userId, online }`
- `message:new`, `message:reaction`, `chat:typing`
- `activity:new`, `activity:member_joined`
- `dm:new`, `dm:new:outgoing`
- `post:new`, `post:like`
- `location:update` (relayed)
- `call:*`

## License

MIT — do what you want, just don't claim you invented orange.
