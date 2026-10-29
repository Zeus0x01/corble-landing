// GitHub API helper — PAT-based, server-side only. Never exposed to the browser.
const API = 'https://api.github.com';

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

interface GhOpts {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  raw?: boolean;
}

async function gh(path: string, opts: GhOpts = {}): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('NOT_CONFIGURED');
  const headers: Record<string, string> = {
    accept: opts.raw ?? false ? 'application/vnd.github.raw' : 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    ...opts.headers,
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body,
    cache: 'no-store',
  });
  return res;
}

export function safeOwnerRepo(owner: string, repo: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(owner) && /^[A-Za-z0-9_.-]+$/.test(repo);
}
export function safeBranch(branch: string): boolean {
  return /^[\w.$-]+$/.test(branch);
}
export function safeRepoPath(path: string): boolean {
  const p = path.replace(/\\/g, '/');
  if (p.includes('..')) return false;
  return p.split('/').every((seg) => /^[^<>:"|?*\x00-\x1f]+$/.test(seg));
}

export async function ghJson<T>(path: string, opts: GhOpts = {}): Promise<T> {
  const res = await gh(path, opts);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`GITHUB ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export type GhEntry = {
  type: 'file' | 'dir';
  path: string;
  name: string;
  size: number;
  sha: string;
  html_url: string;
  git_url: string;
};

export async function listTree(owner: string, repo: string, branch: string, dir: string) {
  const enc = encodeURIComponent(dir).replace(/%2F/g, '/');
  const entries = await ghJson<GhEntry[]>(`/repos/${owner}/${repo}/contents/${dir ? enc : ''}?ref=${encodeURIComponent(branch)}`);
  if (!Array.isArray(entries)) throw new Error('GITHUB invalid response');
  // Sort: directories first, then files, both alphabetically.
  return entries.sort((a, b) =>
    a.type === b.type ? a.path.localeCompare(b.path) : a.type === 'dir' ? -1 : 1
  );
}

export async function readTextFile(owner: string, repo: string, branch: string, path: string) {
  const res = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`, { raw: true });
  if (!res.ok) throw new Error(`GITHUB ${res.status}`);
  const text = await res.text();
  if (text.length > 512_000) throw new Error('FILE_TOO_LARGE');
  // Reject obvious binary payloads.
  // eslint-disable-next-line no-control-regex
  const control = text.slice(0, 8000).match(/[\x00-\x08\x0e-\x1f]/g);
  if (control && control.length > 16) throw new Error('BINARY_FILE');
  return text;
}

export async function fileSha(owner: string, repo: string, branch: string, path: string): Promise<string> {
  const meta = await ghJson<{ sha: string }>(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`);
  return meta.sha;
}

export interface CommitResult {
  commitSha: string;
  htmlUrl: string;
}

export async function commitTextFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
  expectedSha?: string
): Promise<CommitResult> {
  const safe = safeBranch(branch) && safeRepoPath(path);
  if (!safe) throw new Error('INVALID_PATH');
  const currentSha = await fileSha(owner, repo, branch, path);
  if (expectedSha && expectedSha !== currentSha) {
    throw new Error('CONFLICT: file changed remotely — reload and apply your edit again.');
  }
  const out = await ghJson<{ commit: { sha: string }; content: { html_url: string } }>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: message.slice(0, 200),
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch,
        sha: currentSha,
      }),
    }
  );
  return { commitSha: out.commit.sha, htmlUrl: out.content.html_url };
}

export async function repoExists(owner: string, repo: string): Promise<{ ok: boolean; id?: number; private?: boolean; status?: number }> {
  try {
    const meta = await ghJson<{ id: number; private: boolean }>(`/repos/${owner}/${repo}`);
    return { ok: true, id: meta.id, private: meta.private };
  } catch (e) {
    const msg = String(e);
    const m = msg.match(/GITHUB (\d+)/);
    return { ok: false, status: m ? Number(m[1]) : 0 };
  }
}

// A tiny line-level diff summary for the edit preview.
export function simpleDiff(original: string, edited: string): { added: number; removed: number; hunks: { text: string; kind: 'add' | 'del' }[] } {
  const a = original.split('\n');
  const b = edited.split('\n');
  const setA = new Set(a);
  const setB = new Set(b);
  const hunks: { text: string; kind: 'add' | 'del' }[] = [];
  let added = 0;
  let removed = 0;
  for (const line of a) if (!setB.has(line)) { removed++; hunks.push({ text: line, kind: 'del' }); }
  for (const line of b) if (!setA.has(line)) { added++; hunks.push({ text: line, kind: 'add' }); }
  return { added, removed, hunks: hunks.slice(0, 80) };
}
