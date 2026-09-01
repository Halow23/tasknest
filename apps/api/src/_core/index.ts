import "./loadEnv";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { registerWorkspaceEvents } from "./workspaceEvents";
import { registerScheduledJobs } from "./scheduledRoutes";
import { createContext } from "./context";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS for the separated web app (credentials not needed: auth is a Bearer token)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-cron-secret");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  registerWorkspaceEvents(app);
  registerScheduledJobs(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Health check for the hosting platform
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  const port = parseInt(process.env.PORT || "3001");

  server.listen(port, () => {
    console.log(`TaskNest API running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
