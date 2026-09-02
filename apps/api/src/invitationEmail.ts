import { ENV } from "./_core/env";
import nodemailer from "nodemailer";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendWorkspaceInvitationEmail(input: { recipientEmail: string; workspaceName: string; inviteUrl: string; expiresAt: Date }) {
  if (!ENV.smtpHost || !ENV.smtpUser || !ENV.smtpPass || !ENV.smtpFrom) {
    throw new Error("Invitation email delivery is not configured.");
  }

  const workspaceName = escapeHtml(input.workspaceName);
  const inviteUrl = escapeHtml(input.inviteUrl);
  const expiry = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(input.expiresAt);
  
  const transporter = nodemailer.createTransport({
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: ENV.smtpUser,
      pass: ENV.smtpPass,
    },
  });

  const messageId = `tasknest-invite/${input.recipientEmail}/${input.inviteUrl.split("invite=")[1] ?? "link"}@tasknest`;

  try {
    const info = await transporter.sendMail({
      from: ENV.smtpFrom,
      to: input.recipientEmail,
      subject: `You are invited to ${input.workspaceName} on TaskNest`,
      text: `You have been invited to ${input.workspaceName} on TaskNest. Join the workspace using this private link before ${expiry} UTC: ${input.inviteUrl}`,
      html: `<main style="font-family:Arial,sans-serif;color:#172b4d;line-height:1.55"><h1>You are invited to ${workspaceName}</h1><p>Join this private TaskNest workspace using the secure link below. It expires on ${expiry} UTC and can be used once.</p><p><a href="${inviteUrl}" style="display:inline-block;background:#38a9f2;border-radius:8px;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700">Join workspace</a></p><p>If the button does not open, copy this link into your browser:</p><p>${inviteUrl}</p></main>`,
      messageId: messageId,
    });
    return info.messageId;
  } catch (error: any) {
    throw new Error(error.message || "The invitation email could not be delivered.");
  }
}
