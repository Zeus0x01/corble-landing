import { NextRequest } from 'next/server';
import { dbUser } from '@/lib/guard';
import { getWorkflow, n8nConfigured } from '@/lib/n8n';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await dbUser();
  if (!me) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (me.role !== 'ADMIN') {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!n8nConfigured()) {
    return Response.json({ ok: false, error: 'n8n not configured.' }, { status: 503 });
  }
  const { id } = await ctx.params;
  try {
    const { summary, json } = await getWorkflow(id);
    return Response.json({ ok: true, workflow: { ...summary, json } });
  } catch (e) {
    console.error('n8n get error', e instanceof Error ? e.message : e);
    const msg = e instanceof Error && e.message.startsWith('N8N ') ? e.message.slice(0, 240) : 'n8n request failed.';
    return Response.json({ ok: false, error: msg }, { status: 502 });
  }
}
