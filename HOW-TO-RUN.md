# How to run Orange — the beginner's guide

You have three options. Pick whichever matches what you have installed.
Each option gets you a working app you can open in your browser.

---

## Option 1 — Easiest: **no Docker, just Node.js**

This skips Docker entirely. You just need **Node.js 20+** installed
(download from https://nodejs.org).

Open **two** PowerShell or Terminal windows in the `APK Orange` folder.

**Window 1 — start the backend:**

```
cd server
npm install
npm run seed
npm start
```

Wait for: `🧡 Orange server listening on :4000`

**Window 2 — start the frontend:**

```
cd client
npm install
npm run dev
```

Wait for: `Local: http://localhost:5173/`

Now open that URL in your browser. Click **"Try the demo account"**.

---

## Option 2 — Docker Desktop

Install Docker Desktop from https://www.docker.com/products/docker-desktop,
launch it (wait for the whale icon to stop animating), then:

```
copy server\.env.example server\.env
docker compose up --build
```

Open http://localhost:8080.

**If Docker says WSL is too old:** open PowerShell as Administrator and run
`wsl --update`, then restart your computer.

---

## Option 3 — Share a public link with others (Render.com, free)

Use this to let friends access your app from anywhere on the internet.

1. Create a free account at https://render.com
2. Put this project folder on GitHub (https://github.com → New repository →
   upload this folder; or use `git` if you know it).
3. In Render, click **New → Blueprint**, point it at your GitHub repo.
4. Render reads `render.yaml` and creates two services automatically.
5. Click **Apply**. Wait 3-5 minutes for the first deploy.
6. Render gives you a URL like `https://orange-client.onrender.com` — share
   that with anyone.

**Note:** Render's free plan sleeps after 15 min of inactivity. First load
after sleep takes ~30 seconds. Upgrade to $7/mo for always-on.

---

## Option 4 — Share your local app publicly (ngrok, 2 minutes)

Use this to let someone try the app without deploying anywhere.

1. Run Option 1 above so the app is live on your PC.
2. Install **ngrok**: https://ngrok.com/download (free, no credit card).
3. In a **new** terminal, run:

   ```
   ngrok http 5173
   ```

4. ngrok prints a URL like `https://abcd-12-34.ngrok-free.app`. Anyone with
   that URL can use your app from their phone or computer, for free, for as
   long as your terminal stays open.

---

## Logging in

- **Demo account**: email `demo@orange.dev`, password `demodemo`
- Or sign up with your own email — in development mode, **any 6-digit
  verification code works** (the server prints the real one to the terminal
  if you're curious).

## Features to try

1. **Home** — see 8 seeded activities (soccer, yoga, pizza, photowalk, etc.)
2. **Map** — real OpenStreetMap with pins for every activity
3. **Create** — start your own activity; location is geocoded via OSM
4. **Live room** (tap any activity card):
   - **Chat** with emoji reactions and typing indicators
   - **Tasks** — shared to-do list
   - **Notes** — shared scratchpad
   - **Polls** — group polls with live vote bars
   - **People** — all members with online status
   - **Check in** — geofence your arrival
   - **Share location** — broadcast your coords live to the group
5. **Direct messages** — 1:1 chats with presence
6. **Community** — public feed with likes
7. **AI Assistant** (Me → "Orange Assistant") — ask what to do tonight
8. **Profile** — edit bio, follow others, log out

## Want to open it on your phone?

While the dev server is running, find your PC's local IP (`ipconfig` on
Windows, `ifconfig` on Mac), then on your phone browse to
`http://<your-ip>:5173` on the same WiFi network. Or use ngrok (Option 4)
for a proper public URL.

## Troubleshooting

**"command not found: npm"** — Install Node.js from nodejs.org.

**"port 4000 already in use"** — Something else is using it. In the terminal:
`taskkill /F /IM node.exe` (Windows) then try again.

**Browser says "cannot connect"** — Make sure both the server window AND the
client window are still running. Don't close them.

**Activities don't show up** — Make sure you ran `npm run seed` in the
server folder once.
