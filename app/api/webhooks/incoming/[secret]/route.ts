import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { saveUpload } from '@/lib/storage';
import { webhookSecretHash } from '@/lib/webhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;
const CSV_TYPES = new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream']);

export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const webhook = await db.webhook.findUnique({ where: { secretHash: webhookSecretHash(secret) }, select: { id: true, name: true, enabled: true } });
  if (!webhook) return Response.json({ ok: false, error: 'Webhook not found.' }, { status: 404 });
  if (!webhook.enabled) return Response.json({ ok: false, error: 'Webhook is disabled.' }, { status: 410 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: 'Expected multipart/form-data with a CSV file.' }, { status: 400 });
  }
  const value = form.get('file') ?? form.get('csv');
  if (!(value instanceof File) || value.size === 0) return Response.json({ ok: false, error: 'No CSV file provided.' }, { status: 400 });
  const filename = value.name.replace(/[^\w.\- ()]+/g, '_').slice(0, 160) || 'webhook.csv';
  const isCsv = CSV_TYPES.has(value.type) || /\.csv$/i.test(filename);
  if (!isCsv) return Response.json({ ok: false, error: 'Only CSV files are accepted.' }, { status: 415 });
  if (value.size > MAX_BYTES) return Response.json({ ok: false, error: 'File is larger than 10 MB.' }, { status: 413 });

  const bytes = Buffer.from(await value.arrayBuffer());
  const providedKey = req.headers.get('idempotency-key')?.trim();
  const idempotencyKey = (providedKey && /^[\w:.\-]{1,160}$/.test(providedKey) ? providedKey : createHash('sha256').update(bytes).update(filename).digest('hex'));
  const existing = await db.webhookDelivery.findUnique({ where: { webhookId_idempotencyKey: { webhookId: webhook.id, idempotencyKey } }, select: { id: true, status: true, fileAssetId: true } });
  if (existing) {
    return Response.json({ ok: true, duplicate: true, deliveryId: existing.id, fileId: existing.fileAssetId }, { status: 200 });
  }

  let saved: { storageKey: string; storage: 'local' | 's3' };
  try {
    saved = await saveUpload(new File([bytes], filename, { type: 'text/csv' }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Storage upload failed.';
    await db.webhookDelivery.create({ data: { webhookId: webhook.id, filename, size: value.size, status: 'FAILED', idempotencyKey, error: detail } }).catch((logError) => {
      console.error('[webhook] failed to record storage error', logError);
    });
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const file = await tx.fileAsset.create({
        data: { name: filename, size: value.size, mimeType: 'text/csv', storageKey: saved.storageKey, storage: saved.storage, uploadedById: null, webhookId: webhook.id },
        select: { id: true, name: true },
      });
      const delivery = await tx.webhookDelivery.create({
        data: { webhookId: webhook.id, fileAssetId: file.id, filename, size: value.size, status: 'RECEIVED', idempotencyKey },
        select: { id: true },
      });
      await tx.webhook.update({ where: { id: webhook.id }, data: { lastTriggeredAt: new Date() } });
      return { file, delivery };
    });
    return Response.json({ ok: true, webhook: webhook.name, fileId: result.file.id, deliveryId: result.delivery.id }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Database registration failed.';
    await db.webhookDelivery.create({ data: { webhookId: webhook.id, filename, size: value.size, status: 'FAILED', idempotencyKey, error: detail } }).catch((logError) => {
      console.error('[webhook] failed to record database error', logError);
    });
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }
}
