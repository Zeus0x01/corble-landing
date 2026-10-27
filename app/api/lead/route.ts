import { z } from 'zod';
import { db } from '@/lib/db';

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

    const lead = await db.lead.create({
      data: {
        name: data.business || data.name,
        contactPerson: data.name,
        email: data.email,
        notes: data.message || null,
        service: data.need || 'General enquiry',
        source: 'Website',
        status: 'NEW',
        ownerId: admin?.id ?? null,
      },
    });

    await db.activity.create({
      data: {
        message: 'New website enquiry',
        detail: `${lead.name} · ${data.email}`,
        userId: admin?.id ?? null,
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error('Lead error', e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
