import { NextRequest } from 'next/server';
import { dbUser } from '@/lib/guard';
import { db } from '@/lib/db';
import { createWorkflow, n8nConfigured } from '@/lib/n8n';
import { readStoredText } from '@/lib/storage';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const MAX_JSON_CHARS = 800_000;

export async function POST(req: NextRequest) {
  const me = await dbUser();
  if (!me) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (me.role !== 'ADMIN') {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!n8nConfigured()) {
    return Response.json({ ok: false, error: 'n8n not configured.' }, { status: 503 });
  }
  let body: { assetId?: string; name?: string };
  try {
    body = (await req.json()) as { assetId?: string; name?: string };
  } catch {
    return Response.json({ ok: false, error: 'Body must be JSON.' }, { status: 400 });
  }
  if (!body.assetId) return Response.json({ ok: false, error: 'assetId required.' }, { status: 400 });
  const asset = await db.fileAsset.findUnique({ where: { id: body.assetId } });
  if (!asset) return Response.json({ ok: false, error: 'File not found.' }, { status: 404 });
  try {
    const text = await readStoredText(asset.storageKey, asset.storage);
    if (!text) return Response.json({ ok: false, error: 'File content unreadable (storage backend may have removed it).' }, { status: 410 });
    if (text.length > MAX_JSON_CHARS) return Response.json({ ok: false, error: 'File too large for import.' }, { status: 413 });
    const created = await createWorkflow(text, body.name);
    await db.activity.create({
      data: { userId: me.id, message: 'n8n workflow imported', detail: `${created.name} -> n8n id ${created.id} (from ${asset.name})` },
    });
    revalidatePath('/workspace/n8n');
    return Response.json({ ok: true, id: created.id, name: created.name });
  } catch (e) {
    console.error('n8n import error', e instanceof Error ? e.message : e);
    const msg = e instanceof Error && e.message.startsWith('N8N ') ? e.message.slice(0, 240) : e instanceof Error ? e.message.slice(0, 240) : 'Import failed.';
    return Response.json({ ok: false, error: msg }, { status: 502 });
  }
}
