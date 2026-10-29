'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { connectGithub } from '@/lib/actions';

type Repo = {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  updatedAt: string;
};

export default function RepoConnect({ projects }: { projects: { id: string; name: string }[] }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [pickedProject, setPickedProject] = useState<Record<string, string>>({});
  const [branch, setBranch] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setOpen(true);
    if (loaded || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/github/repos', { cache: 'no-store' });
      const data = (await res.json()) as { ok: boolean; repos?: Repo[]; error?: string };
      if (!data.ok || !data.repos) setErr(data.error ?? 'Could not load repos.');
      else setRepos(data.repos);
      setLoaded(true);
    } catch {
      setErr('Could not load repos.');
    } finally {
      setLoading(false);
    }
  }

  const unlinked = projects;

  const list = repos.filter((r) => r.fullName.toLowerCase().includes(q.toLowerCase().trim()));

  async function connect(repo: Repo) {
    const pid = pickedProject[repo.id] ?? '';
    const projectId = pid || undefined;
    const b = (branch[repo.id] ?? '').trim() || repo.defaultBranch || 'main';
    setBusy(String(repo.id));
    const res = await connectGithub({ ...(projectId ? { projectId } : {}), owner: repo.owner, repo: repo.name, branch: b });
    setBusy(null);
    toast(res.error ?? res.message ?? 'Connected.', res.ok ? 'ok' : 'err');
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="btn primary" onClick={load}>＋ Connect repo</button>
      {open && (
        <div className="modalbg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="card modal" role="dialog" aria-modal="true" aria-label="Connect a GitHub repo">
            <div className="panelhead">
              <h2>Connect a GitHub repo</h2>
              <button type="button" className="btn sq" onClick={() => setOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <div className="sub" style={{ marginBottom: 10 }}>
              Pick a repo → Connect. A project is created automatically unless you attach an existing one below the name.
            </div>
            <input
              placeholder="Filter by name or owner…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            {loading ? <div className="empty" style={{ padding: 22 }}>Loading repos…</div> : null}
            {!loading && err ? (
              <div className="empty" style={{ padding: 22 }}>
                {err}
                {!err.includes('GITHUB_TOKEN') ? (
                  <div className="itemsub" style={{ marginTop: 8 }}>
                    <button type="button" className="btn sq" onClick={load}>Retry</button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!loading && !err && list.length === 0 ? (
              <div className="empty" style={{ padding: 22 }}>No repos match this filter.</div>
            ) : null}
            <div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'grid', gap: 8 }}>
              {list.map((repo) => {
                const pid = pickedProject[repo.id] ?? unlinked[0]?.id ?? '';
                return (
                  <div key={repo.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <b style={{ minWidth: 0 }}>{repo.fullName}</b>
                      <span className="pill">{repo.private ? 'private' : 'public'}</span>
                      <span className="itemsub" style={{ marginLeft: 'auto' }}>default: {repo.defaultBranch}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={pid}
                        onChange={(e) => setPickedProject((prev) => ({ ...prev, [repo.id]: e.target.value }))}
                        style={{ flex: '1 1 220px', minWidth: 0 }}
                        aria-label={`Project for ${repo.fullName}`}
                      >
                        <option value="">— new project (auto-created) —</option>
                        {unlinked.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        value={branch[repo.id] ?? ''}
                        onChange={(e) => setBranch((prev) => ({ ...prev, [repo.id]: e.target.value }))}
                        placeholder={repo.defaultBranch}
                        style={{ width: 150, flex: '0 0 150px' }}
                        aria-label={`Branch for ${repo.fullName}`}
                      />
                      <button
                        type="button"
                        className="btn primary"
                        disabled={Boolean(busy)}
                        onClick={() => connect(repo)}
                        title={`Connect ${repo.fullName}`}
                      >
                        {busy === String(repo.id) ? 'Connecting…' : 'Connect'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {repos.length >= 100 ? (
              <div className="sub" style={{ padding: '8px 2px 0' }}>List is capped at 100 repos by the GitHub API.</div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
