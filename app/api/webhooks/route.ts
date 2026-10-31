import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { createWebhookSecret, webhookSecretHash, webhookUrl } from '@/lib/webhooks';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const webhookInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  const user = await dbUser();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const webhooks = await db.webhook.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { files: true } },
      deliveries: { orderBy: { receivedAt: 'desc' }, take: 50 },
    },
  });
  return Response.json({
    ok: true,
    webhooks: webhooks.map((webhook) => ({
      id: webhook.id,
      name: webhook.name,
      description: webhook.description,
      enabled: webhook.enabled,
      ownerId: webhook.ownerId,
      lastTriggeredAt: webhook.lastTriggeredAt,
      fileCount: webhook._count.files,
      deliveries: webhook.deliveries,
    })),
  });
}

export async function POST(req: Request) {
  const user = await dbUser();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const parsed = webhookInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: 'Name is required and description is limited to 500 characters.' }, { status: 400 });
  const secret = createWebhookSecret();
  const webhook = await db.webhook.create({
    data: { ...parsed.data, secretHash: webhookSecretHash(secret), ownerId: user.id },
    select: { id: true, name: true, description: true, enabled: true, createdAt: true },
  });
  return Response.json({ ok: true, webhook, url: webhookUrl(new URL(req.url).origin, secret), secret }, { status: 201 });
}
