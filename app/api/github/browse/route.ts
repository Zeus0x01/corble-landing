import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { listTree, safeOwnerRepo, safeBranch, githubConfigured } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await dbUser();
  if (!session) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  if (!githubConfigured()) return Response.json({ ok: false, error: 'NOT_CONFIGURED', setup: 'Set GITHUB_TOKEN (repo contents:read/write PAT) in the server env.' }, { status: 503 });

  const connId = req.nextUrl.searchParams.get('conn');
  const dir = req.nextUrl.searchParams.get('dir') ?? '';
  if (!connId) return Response.json({ ok: false, error: 'Missing connection id.' }, { status: 400 });
  const conn = await db.gitHubConnection.findUnique({ where: { id: connId }, include: { project: { select: { name: true } } } });
  if (!conn) return Response.json({ ok: false, error: 'Connection not found.' }, { status: 404 });
  if (!safeOwnerRepo(conn.owner, conn.repo) || !safeBranch(conn.branch) || !safeBranch(dir.split('/')[0] ?? 'x') && dir) {
    void 0;
  }
  if (dir.includes('..')) return Response.json({ ok: false, error: 'Invalid path.' }, { status: 400 });
  try {
    const entries = await listTree(conn.owner, conn.repo, conn.branch, dir);
    return Response.json({ ok: true, entries, branch: conn.branch });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    const status = msg.includes('404') ? 404 : 502;
    return Response.json({ ok: false, error: msg.startsWith('NOT_CONFIGURED') ? 'NOT_CONFIGURED' : msg }, { status });
  }
}
