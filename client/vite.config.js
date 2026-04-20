import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// During dev the client hits the Express server directly via VITE_API_URL.
// In production you likely want to proxy /api and /socket.io to the server
// or serve them from the same origin — see README for nginx + docker-compose.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      "/uploads": "http://localhost:4000",
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
