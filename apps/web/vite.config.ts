import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "../../packages/shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname, "../../"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["localhost", "127.0.0.1"],
    // Dev proxy to the separated API (apps/api, port 3001). Keeps relative
    // URLs (/api/trpc, /api/events SSE) working while the two apps run as
    // independent processes.
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
