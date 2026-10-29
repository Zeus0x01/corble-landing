import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { vercelConfigured } from '@/lib/vercel';
import VercelPanel from './VercelPanel';

export const dynamic = 'force-dynamic';

export default async function VercelPage() {
  const session = await auth();
  const role = (session?.user?.role ?? 'MEMBER') as string;

  const projects = await db.project.findMany({
    orderBy: { name: 'asc' },
    include: {
      deploymentConn: { select: { vercelProjectId: true, vercelTeamId: true } },
      deploymentRecords: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, environment: true, url: true, errorSummary: true, createdAt: true } },
    },
  });

  const rows = projects.map((p) => ({
    id: p.id,
    name: p.name,
    connId: p.deploymentConn?.vercelProjectId ?? null,
    vercelProjectId: p.deploymentConn?.vercelProjectId ?? null,
    lastDeploy: p.deploymentRecords[0]
      ? { status: p.deploymentRecords[0].status, environment: p.deploymentRecords[0].environment, url: p.deploymentRecords[0].url, errorSummary: p.deploymentRecords[0].errorSummary, at: p.deploymentRecords[0].createdAt.toISOString() }
      : null,
  }));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Deployments (Vercel)</h2>
          <div className="sub">
            {projects.length} sites · connect a Vercel project per website, then fire preview or production deploys
          </div>
        </div>
      </div>
      <VercelPanel rows={rows} admin={role === 'ADMIN'} configured={vercelConfigured()} />
    </>
  );
}
