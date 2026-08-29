import { ENV } from "./_core/env";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

type DigestTask = { id: number; title: string; dueAt: Date | null; projectName: string };

/**
 * Daily "your day" email per member: tasks due today plus overdue work.
 * Follows the invitation email pattern (plain fetch to Resend, escaped HTML,
 * idempotency key so a retried sweep never double-sends for the same day).
 */
export async function sendDailyDigestEmail(input: { recipientEmail: string; userName: string; dueToday: DigestTask[]; overdue: DigestTask[]; appOrigin: string }) {
  if (!ENV.resendApiKey || !ENV.resendFromEmail) throw new Error("Digest email delivery is not configured.");
  if (input.dueToday.length === 0 && input.overdue.length === 0) throw new Error("Nothing to send.");

  const dateKey = new Date().toISOString().slice(0, 10);
  const taskLink = (task: DigestTask) => `${input.appOrigin.replace(/\/+$/, "")}/?task=${task.id}`;
  const listHtml = (tasks: DigestTask[]) => tasks.map(task => `<li style="margin:4px 0;"><a href="${escapeHtml(taskLink(task))}" style="color:#2a7ba9;text-decoration:none;font-weight:bold;">${escapeHtml(task.title)}</a> <span style="color:#8498a5;font-size:12px;">${escapeHtml(task.projectName)}</span></li>`).join("");

  const html = `<main style="font-family:Arial,sans-serif;color:#172b4d;max-width:560px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;margin:0 0 4px;">Your day on TaskNest</h1>
<p style="margin:0 0 16px;color:#587080;font-size:14px;">Hi ${escapeHtml(input.userName || "there")}, here is where your work stands.</p>
${input.overdue.length ? `<h2 style="font-size:14px;color:#d44a3f;margin:16px 0 6px;">Overdue (${input.overdue.length})</h2><ul style="padding-left:18px;margin:0;font-size:14px;">${listHtml(input.overdue)}</ul>` : ""}
${input.dueToday.length ? `<h2 style="font-size:14px;color:#a36a00;margin:16px 0 6px;">Due today (${input.dueToday.length})</h2><ul style="padding-left:18px;margin:0;font-size:14px;">${listHtml(input.dueToday)}</ul>` : ""}
<p style="margin:20px 0 0;color:#8498a5;font-size:12px;">You receive this because you are a member of a TaskNest workspace.</p>
</main>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `tasknest-digest/${input.recipientEmail}/${dateKey}`,
    },
    body: JSON.stringify({
      from: ENV.resendFromEmail,
      to: [input.recipientEmail],
      subject: `TaskNest digest — ${input.overdue.length} overdue, ${input.dueToday.length} due today`,
      text: `Due today: ${input.dueToday.map(task => `${task.title} (${task.projectName})`).join(", ") || "none"}. Overdue: ${input.overdue.map(task => `${task.title} (${task.projectName})`).join(", ") || "none"}.`,
      html,
    }),
  });

  const result = await response.json().catch(() => null) as { id?: string; message?: string } | null;
  if (!response.ok || !result?.id) throw new Error(result?.message || "The digest email could not be delivered.");
  return result.id;
}
