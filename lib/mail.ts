/**
 * Lightweight email helper.
 * Uses Resend API when RESEND_API_KEY is set; otherwise logs and no-ops
 * so the app never breaks in environments without mail configured.
 *
 * Env:
 *   RESEND_API_KEY  – required to actually send
 *   EMAIL_FROM      – e.g. "Corble <tasks@yourdomain.com>" (must be verified in Resend)
 *   APP_URL         – e.g. https://corble.vercel.app (for links in the email)
 */

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Corble <onboarding@resend.dev>';

  if (!key) {
    console.info('[mail] RESEND_API_KEY not set — skipping email to', to, '·', subject);
    return { ok: false, error: 'Email not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, ' '),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[mail] Resend error', res.status, body);
      return { ok: false, error: `Mail provider error ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[mail] send failed', e);
    return { ok: false, error: 'Failed to send email' };
  }
}

export async function notifyTaskAssigned(opts: {
  assigneeEmail: string;
  assigneeName: string;
  taskTitle: string;
  priority: string;
  status: string;
  dueDate?: Date | null;
  assignedBy: string;
  projectName?: string | null;
}) {
  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'https://corble.vercel.app';
  const due = opts.dueDate
    ? opts.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'No due date';

  const subject = `New task assigned: ${opts.taskTitle}`;
  const html = `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0c10;color:#f2f5f9;border-radius:12px">
    <p style="color:#c8ff00;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 12px">Corble · Task assigned</p>
    <h1 style="font-size:22px;margin:0 0 8px;letter-spacing:-0.03em">Hi ${escapeHtml(opts.assigneeName)},</h1>
    <p style="color:#9aa4b2;margin:0 0 20px"><strong style="color:#f2f5f9">${escapeHtml(opts.assignedBy)}</strong> assigned you a task.</p>
    <div style="background:#12171f;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 18px;margin-bottom:20px">
      <p style="margin:0 0 6px;font-size:16px;font-weight:700">${escapeHtml(opts.taskTitle)}</p>
      <p style="margin:0;color:#9aa4b2;font-size:13px">
        Priority: <strong style="color:#f2f5f9">${escapeHtml(opts.priority)}</strong>
        · Status: <strong style="color:#f2f5f9">${escapeHtml(opts.status)}</strong>
        · Due: <strong style="color:#f2f5f9">${escapeHtml(due)}</strong>
        ${opts.projectName ? `· Project: <strong style="color:#f2f5f9">${escapeHtml(opts.projectName)}</strong>` : ''}
      </p>
    </div>
    <a href="${appUrl}/workspace/tasks" style="display:inline-block;background:#c8ff00;color:#0a0c10;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:10px">Open tasks →</a>
    <p style="color:#818d9c;font-size:12px;margin-top:28px">You’re receiving this because you were assigned a task in Corble Workspace.</p>
  </div>`;

  return sendEmail({ to: opts.assigneeEmail, subject, html });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
