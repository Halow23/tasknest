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
    rollupOptions: {
      output: {
        // Split stable vendor code into cacheable chunks so app-code deploys
        // don't force re-downloads of unchanged libraries.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("firebase")) return "firebase";
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|@tanstack|@trpc|wouter|superjson)[\\/]/.test(id)) return "react-vendor";
          if (/[\\/]node_modules[\\/](date-fns|react-day-picker)[\\/]/.test(id)) return "date";
          if (/[\\/]node_modules[\\/](@radix-ui|lucide-react|sonner|cmdk|class-variance-authority|clsx|tailwind-merge)[\\/]/.test(id)) return "ui-vendor";
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5171,
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
