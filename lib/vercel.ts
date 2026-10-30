// Vercel REST v13 integration — token stays server-side.
const API = 'https://api.vercel.com/v13';

export function vercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN);
}

function team(q: string | undefined): string {
  return q ? `&teamId=${encodeURIComponent(q)}` : '';
}

export interface VercelDeployment {
  id: string;
  state?: string;
  readyState?: string;
  url?: string;
  target?: string | null;
  meta?: Record<string, string>;
  created_at?: number;
}

function mapState(d: VercelDeployment): 'QUEUED' | 'BUILDING' | 'LIVE' | 'FAILED' | 'CANCELLED' {
  const s = d.readyState ?? d.state ?? '';
  if (s === 'READY') return 'LIVE';
  if (s === 'ERROR') return 'FAILED';
  if (s === 'QUEUED') return 'QUEUED';
  if (s === 'CANCELED') return 'CANCELLED';
  return 'BUILDING';
}

export async function latestDeployment(vercelProjectId: string, vercelTeamId?: string) {
  if (!vercelConfigured()) throw new Error('NOT_CONFIGURED');
  const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(vercelProjectId)}&limit=1${team(vercelTeamId)}`, {
    headers: { authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`VERCEL ${res.status}`);
  const data = (await res.json()) as { deployments?: VercelDeployment[] };
  const dep = data.deployments?.[0];
  if (!dep) return { status: 'NOT_CONFIGURED' as const };
  return {
    status: mapState(dep),
    url: dep.url ? `https://${dep.url}` : null,
    commitSha: dep.meta?.githubCommitSha ?? dep.meta?.gitCommitSha ?? null,
    environment: dep.target === 'production' ? ('production' as const) : ('preview' as const),
    vercelId: dep.id,
  };
}

export async function createDeployment(
  vercelProjectId: string,
  vercelTeamId: string | undefined,
  target: 'preview' | 'production',
  opts: { repo?: string; ref?: string; message?: string } = {}
): Promise<{ vercelId: string; url?: string; status: string }> {
  if (!vercelConfigured()) throw new Error('NOT_CONFIGURED');
  const qs = team(vercelTeamId);
  // v13 deployments: bind to the project at the top level; gitSource carries the repo + ref.
  const payload: {
    projectId?: string;
    target?: string;
    meta?: Record<string, string>;
    gitSource?: { type: string; repo: string; ref: string };
  } = { target: target === 'production' ? 'production' : undefined };
  if (opts.message || opts.repo) {
    payload.meta = { ...(opts.message ? { githubCommitMessage: opts.message } : {}) };
  }
  if (opts.repo) {
    payload.projectId = vercelProjectId;
    payload.gitSource = { type: 'github', repo: opts.repo, ref: opts.ref ?? 'main' };
  }
  const res = await fetch(`${API}/deployments${qs ? `?${qs.replace('&', '')}` : ''}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`VERCEL ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as { id: string; readyState?: string; url?: string };
  return { vercelId: data.id, url: data.url ? `https://${data.url}` : undefined, status: mapState({ id: data.id, readyState: data.readyState }) };
}

function slugify(input: string): string {
  const s = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  return s || 'site';
}

// Find-or-create a Vercel project so a freshly connected GitHub repo can deploy right away.
// `name` must be a Vercel-safe slug; returns null when the token is missing or the API rejects.
export async function ensureVercelProject(name: string, vercelTeamId?: string): Promise<{ id: string; name: string } | null> {
  if (!vercelConfigured()) return null;
  const slug = slugify(name);
  const headers = { authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
  try {
    const got = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(slug)}?${team(vercelTeamId).replace('&', '')}`, {
      headers,
      cache: 'no-store',
    });
    if (got.ok) {
      const data = (await got.json()) as { id: string; name: string };
      return { id: data.id, name: data.name };
    }
    if (got.status !== 404) return null;
    const made = await fetch(`https://api.vercel.com/v9/projects?${team(vercelTeamId).replace('&', '')}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: slug }),
      cache: 'no-store',
    });
    if (!made.ok) return null;
    const data = (await made.json()) as { id: string; name: string };
    return { id: data.id, name: data.name };
  } catch {
    return null;
  }
}

export function slugifyVercelName(input: string): string {
  return slugify(input);
}

export async function deploymentLogs(jobUrl: string) {
  return { logsUrl: jobUrl };
}
