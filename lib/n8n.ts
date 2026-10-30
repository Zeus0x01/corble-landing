// n8n REST API helper — server-side only, key never exposed to the browser.
// Env: N8N_BASE_URL (e.g. https://n8n.example.com), N8N_API_KEY.

export type N8nWorkflowSummary = {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string | null;
  tags?: string[];
  nodeCount: number | null;
};

type N8nWorkflowRaw = {
  id: string | number;
  name?: string;
  active?: boolean;
  updatedAt?: string;
  tags?: unknown;
  nodes?: unknown[];
};

function normalizeBase(raw: string): string {
  const v = raw.trim().replace(/\/+$/, '');
  return /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(v) ? v : '';
}

export function n8nConfigured(): boolean {
  const base = process.env.N8N_BASE_URL ?? '';
  return Boolean(normalizeBase(base) && process.env.N8N_API_KEY?.trim());
}

export function n8nMissing(): { baseUrl: boolean; apiKey: boolean } {
  const base = normalizeBase(process.env.N8N_BASE_URL ?? '');
  return { baseUrl: !base, apiKey: !process.env.N8N_API_KEY?.trim() };
}

async function n8n(path: string, init: RequestInit = {}): Promise<Response> {
  const base = normalizeBase(process.env.N8N_BASE_URL ?? '');
  const key = process.env.N8N_API_KEY;
  if (!base || !key) throw new Error('N8N_NOT_CONFIGURED');
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
    'X-N8N-API-KEY': key,
  };
  const res = await fetch(`${base}/api/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    cache: 'no-store',
  });
  return res;
}

async function n8nJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await n8n(path, init);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`N8N ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

function summarize(w: N8nWorkflowRaw): N8nWorkflowSummary {
  const tags = Array.isArray(w.tags)
    ? w.tags.map((t) => (typeof t === 'string' ? t : t && typeof t === 'object' && 'name' in (t as Record<string, unknown>) ? String((t as Record<string, unknown>).name) : '')).filter(Boolean)
    : undefined;
  return {
    id: String(w.id),
    name: w.name ?? `Workflow ${w.id}`,
    active: Boolean(w.active),
    updatedAt: w.updatedAt ?? null,
    tags,
    nodeCount: Array.isArray(w.nodes) ? w.nodes.length : null,
  };
}

/** n8n list API paginates; fetch up to a few pages. */
export async function listWorkflows(q?: string): Promise<{ workflows: N8nWorkflowSummary[]; truncated: boolean }> {
  const out: N8nWorkflowSummary[] = [];
  let truncated = false;
  let cursor: string | null = null;
  for (let page = 0; page < 4; page++) {
    const p: string = cursor ? `/workflows?cursor=${encodeURIComponent(cursor)}` : '/workflows';
    const res: { data?: N8nWorkflowRaw[]; nextCursor?: string } = await n8nJson(p);
    const rows: N8nWorkflowRaw[] = res.data ?? [];
    out.push(...rows.map(summarize));
    cursor = res.nextCursor ?? null;
    if (!cursor || rows.length === 0) break;
    truncated = true;
  }
  const term = (q ?? '').trim().toLowerCase();
  const workflows = term ? out.filter((w) => w.name.toLowerCase().includes(term)) : out;
  return { workflows, truncated };
}

export async function getWorkflow(id: string): Promise<{ summary: N8nWorkflowSummary; json: unknown }> {
  const safe = /^[0-9a-zA-Z_-]+$/.test(id);
  if (!safe) throw new Error('INVALID_ID');
  const w = await n8nJson<N8nWorkflowRaw>(`/workflows/${encodeURIComponent(id)}`);
  return { summary: summarize(w), json: w };
}

/** Import: create a fresh workflow in n8n from JSON. n8n sees an id in the payload → strip it. */
export async function createWorkflow(rawJson: string, forcedName?: string): Promise<{ id: string; name: string }> {
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  const nodes = parsed.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('INVALID_WORKFLOW (needs a nodes array)');
  const body = {
    name: String(forcedName ?? parsed.name ?? 'Imported workflow').slice(0, 120),
    nodes,
    connections: parsed.connections ?? {},
    settings: parsed.settings ?? {},
  };
  const created = await n8nJson<{ id: string | number; name?: string }>('/workflows', { method: 'POST', body: JSON.stringify(body) });
  return { id: String(created.id), name: created.name ?? String(body.name) };
}