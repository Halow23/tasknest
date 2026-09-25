<div align="center">

<img src="apps/web/public/images/tasknest-mark_1fcfb7d8.png" alt="TaskNest logo" width="96" />

# TaskNest

**Team workflow, in focus.**

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-≥20-339933?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=flat&logo=express&logoColor=white)
![tRPC](https://img.shields.io/badge/tRPC-11-2596BE?style=flat)
![Firebase](https://img.shields.io/badge/Firebase-12%2F14-DD2C00?style=flat&logo=firebase&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-2-3448C5?style=flat&logo=cloudinary&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-2-6E9F18?style=flat&logo=vitest&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat&logo=pnpm&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-CBA635?style=flat)

</div>

---

A full-stack task management app: projects and tasks with labels, dependencies, recurrence, time tracking, mentions, notifications, automations, and more.

## Features

- **Tasks** — quick add, reordering, assignees, due dates, custom fields, templates, trash & archiving
- **Relationships** — task dependencies, recurrence, rescheduling
- **Views** — my tasks, calendar, timeline, workload, search
- **Collaboration** — mentions, invites & access management, live events, notifications
- **Extras** — labels, time tracking, automations, CSV export, deep links, file uploads (presigned / Cloudinary), scheduled email digests

## Tech Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces (TypeScript, ESM) |
| Frontend | React + Vite, Tailwind CSS 4, wouter |
| Backend | Node (Express + tRPC), `tsx watch` in dev, esbuild for production |
| Database & Auth | Firebase — Firestore, Auth, Storage |
| Files | Cloudinary |
| Email | SMTP (Nodemailer) |
| Testing | Vitest |

## Project Structure

```
tasknest/
├── apps/
│   ├── api/        # Express + tRPC API (port 3001)
│   └── web/        # React + Vite frontend (port 5171)
├── packages/
│   └── shared/     # Shared types & utilities
├── firebase.json           # Hosting, Firestore & Storage rules, emulators
├── firestore.rules
├── storage.rules
└── .env                    # Root env file, loaded by both apps
```

## Getting Started

### Prerequisites

- **Node.js ≥ 20**
- **pnpm 10.4.1** — enable via Corepack (recommended):

  ```bash
  corepack enable
  ```

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Create a `.env` file at the **repo root** (both apps load it from there). Variables used:

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | web | Firebase client config |
| `VITE_FIREBASE_AUTH_DOMAIN` | web | Firebase client config |
| `VITE_FIREBASE_PROJECT_ID` | web | Firebase client config |
| `VITE_FIREBASE_APP_ID` | web | Firebase client config |
| `VITE_API_URL` | web | Override API base URL (defaults to the Vite proxy) |
| `VITE_APP_TITLE` | web | App title |
| `VITE_USE_FIREBASE_EMULATORS` | web | Point the client at local emulators |
| `FIREBASE_PROJECT_ID` | api | Admin SDK project |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | api | Service-account JSON inline, **or** |
| `firebase-service-account.json` | api | Service-account file at repo root (gitignored) |
| `FIREBASE_STORAGE_BUCKET` | api | Storage bucket |
| `ALLOWED_ORIGINS` | api | CORS allowlist |
| `PORT` | api | API port (default `3001`) |
| `ADMIN_EMAILS` | api | Emails granted admin role |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | api | File uploads |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | api | Email digests (SMTP fallback, local dev) |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` / `GMAIL_USER` | api | Email via Gmail API over HTTPS (primary; SMTP ports are blocked on Railway) |
| `CRON_SECRET` | api | Auth for scheduled job endpoints |
| `DIGEST_APP_ORIGIN` | api | Links included in digest emails |

### 3. Run in development

```bash
pnpm dev
```

This starts both servers:

| App | URL |
|---|---|
| Web (Vite) | http://localhost:5171 |
| API (tRPC) | http://localhost:3001 |

Open **http://localhost:5171** — API requests are proxied through Vite, so you never touch 3001 directly.

> **Windows note:** the `dev` script uses `&` to background the API, which behaves as a *sequential* separator on Windows — the web server may never start. If that happens, run each in its own terminal:
>
> ```bash
> pnpm dev:api
> pnpm dev:web
> ```
>
> or use pnpm's built-in parallel mode:
>
> ```bash
> pnpm --parallel --filter @tasknest/api --filter @tasknest/web dev
> ```

### Optional: Firebase emulators

For local development without touching production Firebase:

```bash
firebase emulators:start
```

Emulator suite: Auth on `:9099`, Firestore on `:8080`, Storage on `:9199`, UI at http://localhost:4000. Set `VITE_USE_FIREBASE_EMULATORS=true` to point the web client at them.

## Scripts

Run from the repo root (all scripts fan out across the workspace):

| Command | Description |
|---|---|
| `pnpm dev` | API + web dev servers (see Windows note above) |
| `pnpm dev:api` | API only, with hot reload |
| `pnpm dev:web` | Frontend only, with HMR |
| `pnpm build` | Build all packages (web → `apps/web/dist`) |
| `pnpm check` | Typecheck all packages (`tsc --noEmit`) |
| `pnpm test` | Run all Vitest suites |
| `pnpm format` | Format with Prettier |

## Scheduled jobs (cron)

Three endpoints drive background sweeps. In production they require the shared
secret via the `x-cron-secret` header (value of `CRON_SECRET`); any scheduler
that can POST works — e.g. Cloud Scheduler or cron-job.org:

| Endpoint | Effect |
|---|---|
| `POST /api/scheduled/reminders` | Creates due-today / overdue bell notifications (deduped per assignee) |
| `POST /api/scheduled/digest` | Sends one "your day" email per member with due/overdue work |
| `POST /api/scheduled/purge` | Permanently deletes trash items past their retention window |

```bash
curl -X POST https://<api-host>/api/scheduled/reminders -H "x-cron-secret: $CRON_SECRET"
```

## Deployment

- **Web** — Vercel (`vercel.json` builds `@tasknest/web` and serves `apps/web/dist`), or Firebase Hosting (`firebase.json` rewrites all routes to `index.html`).
- **Firestore / Storage rules** — deploy with `firebase deploy --only firestore:rules,storage`.
- **API** — built with esbuild (`pnpm --filter @tasknest/api build`), run with `node dist/index.js`.

## License

MIT
