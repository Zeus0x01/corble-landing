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
          <div key={c.id} className="repo-card">
            <div className="repo-card-head">
              <div>
                <div className="repo-title"><span className="repo-mark">◈</span>{c.owner}/{c.repo}</div>
                <div className="repo-meta">
                <a href={`https://github.com/${c.owner}/${c.repo}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)' }}>GitHub repository ↗</a>
                <span className="repo-dot">·</span><span>branch: {c.branch}</span>{c.framework ? <><span className="repo-dot">·</span><span>{c.framework}</span></> : null}
                </div>
              </div>
              <span className="pill connected">connected</span>
            </div>
            <div className="repo-commit">
              <span className="repo-commit-label">Latest commit</span>
              {c.latestCommitMessage ? (
                <span>{c.latestCommitMessage}{c.latestCommitUrl ? <> · <a href={c.latestCommitUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)' }}>view ↗</a></> : null}</span>
              ) : <span className="itemsub">No commit metadata yet</span>}
            </div>
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
