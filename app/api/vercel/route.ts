import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { latestDeployment, createDeployment, vercelConfigured } from '@/lib/vercel';

export const dynamic = 'force-dynamic';

async function withConn(projectId: string) {
  const conn = await db.deploymentConnection.findUnique({ where: { projectId } });
  return conn;
}

export async function GET(req: NextRequest) {
  const me = await dbUser();
  if (!me) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  const projectId = req.nextUrl.searchParams.get('projectId') ?? '';
  const conn = projectId ? await withConn(projectId) : null;
  if (!conn) return Response.json({ ok: true, status: 'NOT_CONFIGURED', setup: 'Connect a project in Workspace → Vercel to enable deployment management.' });
  if (!vercelConfigured()) return Response.json({ ok: true, status: 'NOT_CONFIGURED', setup: 'Set VERCEL_TOKEN in the server env (deploy tokens: api.vercel.com).' });
  try {
    const dep = await latestDeployment(conn.vercelProjectId, conn.vercelTeamId ?? undefined);
    return Response.json({ ok: true, ...dep });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Vercel error' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const me = await dbUser();
  if (!me) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  if (me.role !== 'ADMIN') return Response.json({ ok: false, error: 'Only admins can trigger deployments.' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { projectId?: string; target?: string; commitSha?: string; confirm?: boolean } | null;
  if (!body?.projectId || (body.target !== 'preview' && body.target !== 'production')) {
    return Response.json({ ok: false, error: 'projectId and target (preview|production) required.' }, { status: 400 });
  }
  const conn = await withConn(body.projectId);
  if (!conn) return Response.json({ ok: true, status: 'NOT_CONFIGURED', setup: 'Connect this project first.' });
  const gh = await db.gitHubConnection.findUnique({ where: { projectId: body.projectId }, select: { owner: true, repo: true, branch: true } });
  if (!gh) return Response.json({ ok: false, error: 'Connect the GitHub repo first (Websites tab) — deploys build from it.' }, { status: 409 });
  if (body.target === 'production' && body.confirm !== true) {
    return Response.json({ ok: false, error: 'Production deployments require confirm: true.' }, { status: 400 });
  }
  try {
    const res = await createDeployment(conn.vercelProjectId, conn.vercelTeamId ?? undefined, body.target, {
      repo: `${gh.owner}/${gh.repo}`,
      ref: body.commitSha ?? gh.branch,
    });
    const record = await db.deploymentRecord.create({
      data: {
        projectId: body.projectId,
        vercelId: res.vercelId,
        environment: body.target,
        status: res.status as 'QUEUED' | 'BUILDING' | 'LIVE' | 'FAILED' | 'CANCELLED',
        url: res.url ?? null,
        commitSha: body.commitSha ?? null,
      },
    });
    await db.activity.create({ data: { message: `Vercel ${body.target} deployment started`, detail: record.id, userId: me.id } });
    return Response.json({ ok: true, vercelId: res.vercelId, url: res.url, status: res.status, recordId: record.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Vercel error';
    await db.activity.create({ data: { message: 'Vercel deployment failed', detail: msg.slice(0, 200), userId: me.id } });
    return Response.json({ ok: false, error: msg }, { status: 502 });
  }
}
