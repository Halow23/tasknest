import { ENV } from "./env";

export type OutgoingEmail = { to: string; subject: string; text: string; html: string; messageId?: string };

/**
 * Sends email over HTTPS. Primary transport is the Gmail API (works everywhere,
 * including hosts that block outbound SMTP such as Railway); SMTP (Nodemailer)
 * is the fallback for local development.
 */
export async function sendEmail(email: OutgoingEmail): Promise<{ messageId: string }> {
  if (ENV.gmailConfigured) return sendViaGmail(email);
  if (ENV.smtpConfigured) return sendViaSmtp(email);
  throw new Error("Email delivery is not configured (set GMAIL_* or SMTP_* variables).");
}

function fromAddress(): string {
  const address = ENV.gmailUser || ENV.smtpUser;
  if (!address) throw new Error("No sender address configured (GMAIL_USER or SMTP_USER).");
  return `TaskNest <${address}>`;
}

function encodeHeader(value: string): string {
  if (!/[^\x20-\x7e]/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

function base64Body(content: string): string {
  // RFC 2045 requires max 76 chars per line.
  return Buffer.from(content, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
}

function buildMime(email: OutgoingEmail): string {
  const boundary = `tn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const headers = [
    `From: ${fromAddress()}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(email.subject)}`,
    "MIME-Version: 1.0",
  ];
  if (email.messageId) headers.push(`Message-ID: <${email.messageId}>`);
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(email.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(email.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

async function sendViaGmail(email: OutgoingEmail): Promise<{ messageId: string }> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.gmailClientId,
      client_secret: ENV.gmailClientSecret,
      refresh_token: ENV.gmailRefreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenRes.ok) {
    throw new Error(`Gmail token refresh failed (${tokenRes.status}): ${(await tokenRes.text()).slice(0, 200)}`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(buildMime(email), "utf8").toString("base64url") }),
    signal: AbortSignal.timeout(20000),
  });
  if (!sendRes.ok) {
    throw new Error(`Gmail send failed (${sendRes.status}): ${(await sendRes.text()).slice(0, 200)}`);
  }
  const data = (await sendRes.json()) as { id: string };
  return { messageId: data.id };
}

async function sendViaSmtp(email: OutgoingEmail): Promise<{ messageId: string }> {
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpPort === 465,
    auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  const info = await transporter.sendMail({
    from: ENV.smtpFrom,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    ...(email.messageId ? { messageId: email.messageId } : {}),
  });
  return { messageId: info.messageId };
}
