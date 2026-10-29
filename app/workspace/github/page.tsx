import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { githubConfigured } from '@/lib/github';
import { disconnectGithub } from '@/lib/actions';
import ConfirmAction from '@/components/ConfirmAction';
import GitHubBrowser from './GitHubBrowser';
import RepoConnect from './RepoConnect';

export const dynamic = 'force-dynamic';

export default async function GitHubPage() {
  const session = await auth();
  const me = session?.user?.id as string;
  const role = (session?.user?.role ?? 'MEMBER') as string;
  const admin = role === 'ADMIN';

  const [connections, projects] = await Promise.all([
    db.gitHubConnection.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { project: { select: { name: true } } },
    }),
    db.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const unlinked = projects.filter((p) => !connections.some((c) => c.projectId === p.id));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Websites (GitHub)</h2>
          <div className="sub">
            {connections.length} connected repos · browsing is read-only for members; commits hit the PAT, admin-only, never to main/master/production branches
          </div>
        </div>
        {admin ? <RepoConnect projects={unlinked} /> : null}
      </div>

      {!githubConfigured() ? (
        <div className="tablewrap" style={{ marginBottom: 12 }}>
          <div className="empty">GITHUB_TOKEN is not set in server env — add a PAT with contents:read/write, then reload.</div>
        </div>
      ) : null}

      {connections.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">No repos connected yet.</div>
        </div>
      ) : (
        connections.map((c) => (
          <div key={c.id} className="tablewrap" style={{ marginBottom: 16 }}>
            <GitHubBrowser conn={{ id: c.id, owner: c.owner, repo: c.repo, branch: c.branch, projectName: c.project?.name }} admin={admin} />
            {admin ? (
              <div style={{ padding: '4px 0 0 2px' }}>
                <ConfirmAction action={disconnectGithub} payload={c.projectId ?? c.id} label={`Disconnect ${c.owner}/${c.repo}`} confirmText="Disconnect this repo?" />
              </div>
            ) : null}
          </div>
        ))
      )}
    </>
  );
}
