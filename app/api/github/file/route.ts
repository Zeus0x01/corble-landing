import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { readTextFile, fileSha, commitTextFile, simpleDiff } from '@/lib/github';

export const dynamic = 'force-dynamic';

function connGuard(role: string) {
  // only admins may write; any active member may read
  return role === 'ADMIN' || role === 'MEMBER';
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  if (!connGuard((session.user.role ?? 'MEMBER') as string)) return Response.json({ ok: false, error: 'Not allowed.' }, { status: 403 });
  const connId = req.nextUrl.searchParams.get('conn') ?? '';
  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!connId || !path || path.includes('..')) return Response.json({ ok: false, error: 'Missing/invalid params.' }, { status: 400 });
  const conn = await db.gitHubConnection.findUnique({ where: { id: connId } });
  if (!conn) return Response.json({ ok: false, error: 'Connection not found.' }, { status: 404 });
  try {
    const [content, sha] = await Promise.all([
      readTextFile(conn.owner, conn.repo, conn.branch, path),
      fileSha(conn.owner, conn.repo, conn.branch, path),
    ]);
    return Response.json({ ok: true, content, sha, branch: conn.branch, path });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    const status = msg === 'BINARY_FILE' || msg === 'FILE_TOO_LARGE' ? 415 : msg.includes('404') ? 404 : 502;
    return Response.json({ ok: false, error: msg }, { status });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  if ((session.user.role ?? 'MEMBER') !== 'ADMIN') {
    return Response.json({ ok: false, error: 'Only admins can commit files to GitHub.' }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { connId?: string; path?: string; content?: string; message?: string; expectedSha?: string } | null;
  if (!body?.connId || !body.path || typeof body.content !== 'string' || body.path.includes('..')) {
    return Response.json({ ok: false, error: 'Missing/invalid params.' }, { status: 400 });
  }
  const conn = await db.gitHubConnection.findUnique({ where: { id: body.connId } });
  if (!conn) return Response.json({ ok: false, error: 'Connection not found.' }, { status: 404 });
  if (conn.branch === 'main' || conn.branch === 'master' || conn.branch === 'production') {
    return Response.json(
      { ok: false, error: `Refusing to write directly to "${conn.branch}" — explicit production permission flow required. Edit a feature branch connection instead.` },
      { status: 403 }
    );
  }
  try {
    const original = await readTextFile(conn.owner, conn.repo, conn.branch, body.path);
    const diff = simpleDiff(original, body.content);
    const result = await commitTextFile(conn.owner, conn.repo, conn.branch, body.path, body.content, body.message ?? `Corble workspace edit: ${body.path}`, body.expectedSha);
    await db.gitHubConnection.update({ where: { id: conn.id }, data: { lastSha: result.commitSha } });
    await db.activity.create({
      data: { message: 'GitHub commit', detail: `${conn.owner}/${conn.repo}@${conn.branch} ${body.path} (+${diff.added}/−${diff.removed})`, userId: session.user.id },
    });
    return Response.json({ ok: true, ...result, diff });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return Response.json({ ok: false, error: msg.startsWith('CONFLICT') ? msg : `Commit failed: ${msg}` }, { status: 409 });
  }
}
