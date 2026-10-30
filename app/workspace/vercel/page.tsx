import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { vercelConfigured, latestDeployment } from '@/lib/vercel';
import VercelPanel from './VercelPanel';

export const dynamic = 'force-dynamic';

export default async function VercelPage() {
  const session = await auth();
  const role = (session?.user?.role ?? 'MEMBER') as string;

  const projects = await db.project.findMany({
    orderBy: { name: 'asc' },
    include: {
      deploymentConn: { select: { vercelProjectId: true, vercelTeamId: true } },
      githubConnections: { take: 1, select: { owner: true, repo: true, branch: true, lastSha: true, latestCommitMessage: true, latestCommitUrl: true } },
      deploymentRecords: { orderBy: { createdAt: 'desc' }, take: 10, select: { status: true, environment: true, url: true, errorSummary: true, commitSha: true, createdAt: true } },
    },
  });

  // Sync live deployment state from Vercel so the labels come from the provider, not the UI.
  const configured = vercelConfigured();
  const results = configured
    ? await Promise.all(projects.map(async (p) => {
        if (!p.deploymentConn) return { preview: null, production: null };
        const [preview, production] = await Promise.allSettled([
          latestDeployment(p.deploymentConn.vercelProjectId, p.deploymentConn.vercelTeamId ?? undefined, 'preview'),
          latestDeployment(p.deploymentConn.vercelProjectId, p.deploymentConn.vercelTeamId ?? undefined, 'production'),
        ]);
        return {
          preview: preview.status === 'fulfilled' ? preview.value : null,
          production: production.status === 'fulfilled' ? production.value : null,
        };
      }))
    : projects.map(() => ({ preview: null, production: null }));
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    if (!p.deploymentConn) continue;
    for (const live of [results[i].preview, results[i].production]) {
      if (!live || !('vercelId' in live) || !live.vercelId) continue;
      const existing = await db.deploymentRecord.findFirst({ where: { vercelId: live.vercelId, projectId: p.id }, select: { id: true } });
      if (existing) {
        await db.deploymentRecord.update({ where: { id: existing.id }, data: { status: live.status, url: live.url, commitSha: live.commitSha, errorSummary: live.errorSummary } });
      } else {
        await db.deploymentRecord.create({
          data: { projectId: p.id, vercelId: live.vercelId, environment: live.environment ?? 'preview', status: live.status, url: live.url, commitSha: live.commitSha, errorSummary: live.errorSummary },
        });
      }
    }
  }

  const rows = projects.map((p, i) => {
    const storedFor = (environment: string) => {
      const record = p.deploymentRecords.find((item) => item.environment === environment);
      return record
        ? { status: record.status, environment: record.environment, url: record.url, errorSummary: record.errorSummary, commitSha: record.commitSha, at: record.createdAt.toISOString() }
        : null;
    };
    const stored = storedFor('preview');
    const productionStored = storedFor('production');
    const previewLive = results[i].preview;
    const productionLive = results[i].production;
    const previewDeploy = previewLive && 'vercelId' in previewLive && previewLive.vercelId
      ? { status: previewLive.status, environment: 'preview', url: previewLive.url ?? stored?.url ?? null, errorSummary: previewLive.errorSummary ?? stored?.errorSummary ?? null, commitSha: previewLive.commitSha ?? stored?.commitSha ?? null, at: stored?.at ?? new Date().toISOString() }
      : stored;
    const productionDeploy = productionLive && 'vercelId' in productionLive && productionLive.vercelId
      ? { status: productionLive.status, environment: 'production', url: productionLive.url ?? productionStored?.url ?? null, errorSummary: productionLive.errorSummary ?? productionStored?.errorSummary ?? null, commitSha: productionLive.commitSha ?? productionStored?.commitSha ?? null, at: productionStored?.at ?? new Date().toISOString() }
      : productionStored;
    return {
      id: p.id,
      name: p.name,
      connId: p.deploymentConn?.vercelProjectId ?? null,
      vercelProjectId: p.deploymentConn?.vercelProjectId ?? null,
      repo: p.githubConnections[0] ? `${p.githubConnections[0].owner}/${p.githubConnections[0].repo} · ${p.githubConnections[0].branch}` : null,
      latestCommit: p.githubConnections[0] ? {
        sha: p.githubConnections[0].lastSha,
        message: p.githubConnections[0].latestCommitMessage,
        url: p.githubConnections[0].latestCommitUrl,
      } : null,
      previewDeploy,
      productionDeploy,
    };
  });

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Deployments (Vercel)</h2>
          <div className="sub">
            {projects.length} sites · GitHub connections automatically create preview deployments; production deploys remain manual
          </div>
        </div>
      </div>
      <VercelPanel rows={rows} admin={role === 'ADMIN'} configured={configured} />
    </>
  );
}
