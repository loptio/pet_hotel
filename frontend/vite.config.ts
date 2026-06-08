import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // S4 integration: proxy /api → backend (uvicorn on 127.0.0.1:8000) so the
    // SPA and API are same-origin in dev (no CORS, Bearer header flows through).
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (p) => p,
      },
    },
  },
})
