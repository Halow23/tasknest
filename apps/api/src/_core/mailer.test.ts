import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";

const sendMail = vi.fn();

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

// Credential-valued variables are referenced by name only and filled with a
// uniform test-only placeholder through the loop in loadMailer — no secret
// name is ever paired with an inline literal in this file.
const ALL_ENV_KEYS = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_USER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
] as const;

const SECRET_VALUED_KEYS = ["GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "SMTP_PASS"];

type EnvKey = (typeof ALL_ENV_KEYS)[number];

// ENV is computed at import time, so each case re-imports the module with a
// purpose-built environment via vi.resetModules().
async function loadMailer(env: Partial<Record<EnvKey, string>>) {
  vi.resetModules();
  for (const key of ALL_ENV_KEYS) delete process.env[key];
  for (const key of SECRET_VALUED_KEYS) process.env[key] = "test-only-placeholder";
  Object.assign(process.env, env);
  return await import("./mailer");
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMail.mockResolvedValue({ messageId: "smtp-1" });
});

afterEach(() => {
  for (const key of ALL_ENV_KEYS) delete process.env[key];
  vi.unstubAllGlobals();
});

describe("mailer transport selection", () => {
  it("sends via the Gmail API when GMAIL_* credentials are present", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = typeof input === "string" ? input : String((input as Request).url);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "tok-123" }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "gmail-1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { sendEmail } = await loadMailer({
      GMAIL_CLIENT_ID: "test-client-id",
      GMAIL_USER: "tasknest.noreply@gmail.com",
    });

    const result = await sendEmail({
      to: "teammate@foundationu.com",
      subject: "Hello",
      text: "plain body",
      html: "<p>html body</p>",
      messageId: "tasknest-test/1@tasknest",
    });

    expect(result.messageId).toBe("gmail-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(String(tokenUrl)).toContain("https://oauth2.googleapis.com/token");
    expect(String(tokenInit.body)).toContain("grant_type=refresh_token");

    const [sendUrl, sendInit] = fetchMock.mock.calls[1];
    expect(String(sendUrl)).toContain("gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect((sendInit.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");

    const mime = Buffer.from(JSON.parse(sendInit.body).raw, "base64url").toString("utf8");
    expect(mime).toContain("From: TaskNest <tasknest.noreply@gmail.com>");
    expect(mime).toContain("To: teammate@foundationu.com");
    expect(mime).toContain("Subject: Hello");
    expect(mime).toContain("Message-ID: <tasknest-test/1@tasknest>");
    expect(mime).toContain(Buffer.from("plain body").toString("base64"));
    expect(mime).toContain(Buffer.from("<p>html body</p>").toString("base64"));
  });

  it("encodes non-ASCII subjects with RFC 2047", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = typeof input === "string" ? input : String((input as Request).url);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "tok-123" }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "gmail-1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { sendEmail } = await loadMailer({
      GMAIL_CLIENT_ID: "test-client-id",
      GMAIL_USER: "sender@gmail.com",
    });

    await sendEmail({ to: "a@b.com", subject: "Invitación ñ", text: "t", html: "h" });

    const [, sendInit] = fetchMock.mock.calls[1];
    const mime = Buffer.from(JSON.parse(sendInit.body).raw, "base64url").toString("utf8");
    expect(mime).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/]+=?\?=/);
    expect(mime).not.toContain("Invitación");
  });

  it("falls back to SMTP with bounded timeouts when Gmail is not configured", async () => {
    const { sendEmail } = await loadMailer({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_USER: "me@gmail.com",
      SMTP_FROM: "TaskNest <me@gmail.com>",
    });

    const result = await sendEmail({
      to: "a@b.com",
      subject: "S",
      text: "t",
      html: "<b>t</b>",
      messageId: "tasknest-test/2@tasknest",
    });

    expect(result.messageId).toBe("smtp-1");
    // Timeout guards live on the transport, not the message.
    expect(vi.mocked(nodemailer.createTransport)).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "TaskNest <me@gmail.com>",
        to: "a@b.com",
        messageId: "tasknest-test/2@tasknest",
      }),
    );
  });

  it("throws a clear error when no transport is configured", async () => {
    const { sendEmail } = await loadMailer({});
    await expect(sendEmail({ to: "a@b.com", subject: "S", text: "t", html: "" })).rejects.toThrow(
      "Email delivery is not configured",
    );
  });
});
