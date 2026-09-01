export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Comma-separated list of emails that receive the admin role on first sign-in.
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean),
  // Shared secret required by the /api/scheduled/* cron endpoints.
  cronSecret: process.env.CRON_SECRET ?? "",
  // Comma-separated list of browser origins allowed to call the API.
  allowedOrigins: process.env.ALLOWED_ORIGINS ?? "http://localhost:5173",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
};
