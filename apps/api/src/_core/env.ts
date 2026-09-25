const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
const gmailConfigured = !!(
  process.env.GMAIL_CLIENT_ID &&
  process.env.GMAIL_CLIENT_SECRET &&
  process.env.GMAIL_REFRESH_TOKEN &&
  (process.env.GMAIL_USER || process.env.SMTP_USER)
);

export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  // Comma-separated list of emails that receive the admin role on first sign-in.
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean),
  // Shared secret required by the /api/scheduled/* cron endpoints.
  cronSecret: process.env.CRON_SECRET ?? "",
  // Comma-separated list of browser origins allowed to call the API.
  allowedOrigins: process.env.ALLOWED_ORIGINS ?? "http://localhost:5171",
  // Gmail API transport (HTTPS) — primary on hosts that block SMTP, e.g. Railway.
  gmailClientId: process.env.GMAIL_CLIENT_ID ?? "",
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
  gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
  gmailUser: process.env.GMAIL_USER ?? "",
  // SMTP transport (Nodemailer) — fallback for local development.
  smtpConfigured,
  gmailConfigured,
  emailConfigured: gmailConfigured || smtpConfigured,
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "",
};
