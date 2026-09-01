import { config as loadEnv } from "dotenv";
import path from "node:path";

// The .env lives at the monorepo root (one shared file for web + api); plain
// `dotenv/config` would look only in this process's cwd (apps/api). This
// module must stay the first import of index.ts: ENV in env.ts snapshots
// process.env at import time, so the variables must be loaded before any
// module that reads them evaluates.
loadEnv({ path: path.resolve(import.meta.dirname, "../../../../.env") });
loadEnv(); // local override: apps/api/.env, if present
