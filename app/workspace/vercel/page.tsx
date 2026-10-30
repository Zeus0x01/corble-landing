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
      githubConnections: { take: 1, select: { owner: true, repo: true, branch: true } },
      deploymentRecords: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, environment: true, url: true, errorSummary: true, createdAt: true } },
    },
  });

  // Sync live deployment state from Vercel so the labels come from the provider, not the UI.
  const configured = vercelConfigured();
  const results = configured
    ? await Promise.allSettled(
        projects.map((p) => (p.deploymentConn ? latestDeployment(p.deploymentConn.vercelProjectId, p.deploymentConn.vercelTeamId ?? undefined) : Promise.resolve(null)))
      )
    : [];
  const liveOf = (i: number) => {
    const r = results[i];
    return r && r.status === 'fulfilled' ? r.value : null;
  };
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    if (!p.deploymentConn) continue;
    const live = liveOf(i);
    if (!live || !('vercelId' in live) || !live.vercelId) continue;
    const existing = await db.deploymentRecord.findFirst({ where: { vercelId: live.vercelId, projectId: p.id }, select: { id: true } });
    if (existing) {
      await db.deploymentRecord.update({ where: { id: existing.id }, data: { status: live.status, url: live.url, commitSha: live.commitSha } });
    } else {
      await db.deploymentRecord.create({
        data: { projectId: p.id, vercelId: live.vercelId, environment: 'environment' in live ? (live.environment ?? 'preview') : 'preview', status: live.status, url: live.url, commitSha: live.commitSha },
      });
    }
  }

  const rows = projects.map((p, i) => {
    const stored = p.deploymentRecords[0]
      ? { status: p.deploymentRecords[0].status, environment: p.deploymentRecords[0].environment, url: p.deploymentRecords[0].url, errorSummary: p.deploymentRecords[0].errorSummary, at: p.deploymentRecords[0].createdAt.toISOString() }
      : null;
    const live = liveOf(i);
    const lastDeploy = live && 'vercelId' in live && live.vercelId
      ? { status: live.status, environment: live.environment ?? stored?.environment ?? 'preview', url: live.url ?? stored?.url ?? null, errorSummary: stored?.errorSummary ?? null, at: stored?.at ?? new Date().toISOString() }
      : stored;
    return {
      id: p.id,
      name: p.name,
      connId: p.deploymentConn?.vercelProjectId ?? null,
      vercelProjectId: p.deploymentConn?.vercelProjectId ?? null,
      repo: p.githubConnections[0] ? `${p.githubConnections[0].owner}/${p.githubConnections[0].repo} · ${p.githubConnections[0].branch}` : null,
      lastDeploy,
    };
  });

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Deployments (Vercel)</h2>
          <div className="sub">
            {projects.length} sites · sites connected via the GitHub tab appear here automatically; fire preview or production deploys
          </div>
        </div>
      </div>
      <VercelPanel rows={rows} admin={role === 'ADMIN'} configured={configured} />
    </>
  );
}
