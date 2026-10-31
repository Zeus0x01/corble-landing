import { z } from 'zod';
import { db } from '@/lib/db';
import { allocateLeadCode } from '@/lib/lead-id';
import { sendEmail } from '@/lib/mail';

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  business: z.string().max(160).optional().default(''),
  need: z.string().max(80).optional().default(''),
  message: z.string().max(2000).optional().default(''),
});

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
    const data = parsed.data;

    const admin = await db.user.findFirst({
      where: { isActive: true, role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });

    const lead = await db.$transaction(async (tx) => tx.lead.create({
      data: {
        leadCode: await allocateLeadCode(tx),
        name: data.business || data.name,
        contactPerson: data.name,
        email: data.email,
        notes: data.message || null,
        service: data.need || 'General enquiry',
        source: 'Website',
        status: 'NEW',
        ownerId: admin?.id ?? null,
      },
    }));

    await db.activity.create({
      data: {
        message: 'New website enquiry',
        detail: `${lead.name} · ${data.email}`,
        userId: admin?.id ?? null,
      },
    });

    if (admin?.email) {
      await sendEmail({
        to: admin.email,
        from: process.env.EMAIL_FROM_ALERTS,
        replyTo: data.email,
        subject: `New website enquiry from ${data.name}`,
        html: `<h2>New Corble website enquiry</h2><p><strong>Name:</strong> ${escapeHtml(data.name)}</p><p><strong>Email:</strong> ${escapeHtml(data.email)}</p><p><strong>Business:</strong> ${escapeHtml(data.business || 'Not provided')}</p><p><strong>Need:</strong> ${escapeHtml(data.need || 'Not specified')}</p><p>${escapeHtml(data.message || 'No message provided')}</p>`,
      });
    }
    await sendEmail({
      to: data.email,
      from: process.env.EMAIL_FROM_HELLO,
      subject: 'Thanks for contacting Corble',
      html: `<p>Hi ${escapeHtml(data.name)},</p><p>Thanks for reaching out to Corble. We received your enquiry and will review it before replying.</p><p>— Corble</p>`,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error('Lead error', e);
    return Response.json({ ok: false }, { status: 500 });
  }

  function escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
