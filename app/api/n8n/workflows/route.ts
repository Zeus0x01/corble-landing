import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { listWorkflows, n8nConfigured, n8nMissing } from '@/lib/n8n';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if ((session?.user?.role ?? 'MEMBER') !== 'ADMIN') {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!n8nConfigured()) {
    const missing = n8nMissing();
    return Response.json(
      { ok: false, error: `n8n not configured (missing: ${[missing.baseUrl ? 'N8N_BASE_URL' : '', missing.apiKey ? 'N8N_API_KEY' : ''].filter(Boolean).join(', ')})` },
      { status: 503 }
    );
  }
  const q = req.nextUrl.searchParams.get('q') ?? undefined;
  try {
    const { workflows, truncated } = await listWorkflows(q);
    return Response.json({ ok: true, workflows, truncated });
  } catch (e) {
    console.error('n8n list error', e instanceof Error ? e.message : e);
    const msg = e instanceof Error && e.message.startsWith('N8N ') ? e.message.slice(0, 240) : 'n8n request failed.';
    return Response.json({ ok: false, error: msg }, { status: 502 });
  }
}
