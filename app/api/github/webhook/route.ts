import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createDeployment } from '@/lib/vercel';

export const dynamic = 'force-dynamic';

function validSignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`);
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const payload = JSON.parse(raw) as {
    ref?: string;
    repository?: { full_name?: string; owner?: { login?: string }; name?: string };
    head_commit?: { id?: string; message?: string; timestamp?: string; url?: string };
  };
  const owner = payload.repository?.owner?.login ?? payload.repository?.full_name?.split('/')[0] ?? '';
  const repo = payload.repository?.name ?? payload.repository?.full_name?.split('/')[1] ?? '';
  if (!owner || !repo) return Response.json({ ok: false, error: 'Repository information is missing.' }, { status: 400 });

  const connection = await db.gitHubConnection.findFirst({
    where: { owner, repo },
    select: { id: true, projectId: true, branch: true, webhookSecret: true },
  });
  if (!connection?.webhookSecret) return Response.json({ ok: false, error: 'Webhook is not registered.' }, { status: 404 });
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'), connection.webhookSecret)) {
    return Response.json({ ok: false, error: 'Invalid signature.' }, { status: 401 });
  }

  const branch = payload.ref?.replace(/^refs\/heads\//, '');
  const commit = payload.head_commit;
  if (!branch || branch !== connection.branch || !commit?.id) return Response.json({ ok: true, ignored: true });

  await db.gitHubConnection.update({
    where: { id: connection.id },
    data: {
      lastSha: commit.id,
      latestCommitMessage: commit.message?.split('\n')[0].slice(0, 240) ?? null,
      latestCommitUrl: commit.url ?? null,
      latestCommitAt: commit.timestamp ? new Date(commit.timestamp) : null,
    },
  });

  if (!connection.projectId) return Response.json({ ok: true, synced: true, deployed: false });
  const deployment = await db.deploymentConnection.findUnique({ where: { projectId: connection.projectId } });
  if (!deployment) return Response.json({ ok: true, synced: true, deployed: false });

  try {
    const out = await createDeployment(deployment.vercelProjectId, deployment.vercelTeamId ?? undefined, 'preview', {
      repo: `${owner}/${repo}`,
      ref: branch,
      message: `Automatic preview deployment for ${commit.id.slice(0, 7)}`,
    });
    await db.deploymentRecord.create({
      data: {
        projectId: connection.projectId,
        vercelId: out.vercelId,
        environment: 'preview',
        status: out.status as 'QUEUED' | 'BUILDING' | 'LIVE' | 'FAILED' | 'CANCELLED',
        url: out.url ?? null,
        commitSha: commit.id,
      },
    });
    return Response.json({ ok: true, synced: true, deployed: true, deploymentId: out.vercelId });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Vercel preview deployment failed';
    await db.deploymentRecord.create({
      data: { projectId: connection.projectId, environment: 'preview', status: 'FAILED', commitSha: commit.id, errorSummary: message },
    });
    return Response.json({ ok: false, synced: true, deployed: false, error: message }, { status: 502 });
  }
}
