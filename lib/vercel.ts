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
    vercelId: dep.id,
  };
}

export async function createDeployment(
  vercelProjectId: string,
  vercelTeamId: string | undefined,
  target: 'preview' | 'production',
  opts: { commitSha?: string; message?: string } = {}
): Promise<{ vercelId: string; url?: string; status: string }> {
  if (!vercelConfigured()) throw new Error('NOT_CONFIGURED');
  const qs = team(vercelTeamId);
  const payload: { gitSource?: { type: string; ref: string; projectId: string }; target?: string } = {
    target: target === 'production' ? 'production' : undefined,
  };
  if (opts.commitSha) {
    payload.gitSource = { type: 'github', ref: opts.commitSha, projectId: vercelProjectId };
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

export async function deploymentLogs(jobUrl: string) {
  return { logsUrl: jobUrl };
}
