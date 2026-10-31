import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { createWebhookSecret, webhookSecretHash, webhookUrl } from '@/lib/webhooks';
import { z } from 'zod';

const webhookInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  enabled: z.boolean().optional(),
  regenerateSecret: z.boolean().optional(),
});

async function ownedWebhook(id: string) {
  const user = await dbUser();
  if (!user) return { response: Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  const webhook = await db.webhook.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!webhook) return { response: Response.json({ ok: false, error: 'Webhook not found.' }, { status: 404 }) };
  if (user.role !== 'ADMIN' && webhook.ownerId !== user.id) return { response: Response.json({ ok: false, error: 'Forbidden.' }, { status: 403 }) };
  return { user, webhook };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await ownedWebhook(id);
  if ('response' in access) return access.response;
  const parsed = webhookInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: 'Invalid webhook details.' }, { status: 400 });
  const secret = parsed.data.regenerateSecret ? createWebhookSecret() : null;
  const webhook = await db.webhook.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      ...(parsed.data.enabled === undefined ? {} : { enabled: parsed.data.enabled }),
      ...(secret ? { secretHash: webhookSecretHash(secret) } : {}),
    },
    select: { id: true, name: true, description: true, enabled: true, createdAt: true },
  });
  return Response.json({ ok: true, webhook, ...(secret ? { url: webhookUrl(new URL(req.url).origin, secret), secret } : {}) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await ownedWebhook(id);
  if ('response' in access) return access.response;
  await db.webhook.delete({ where: { id } });
  return Response.json({ ok: true });
}
