'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { exportN8nWorkflow, importN8nWorkflow } from '@/lib/actions';

type WorkflowSummary = {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string | null;
  tags?: string[];
  nodeCount: number | null;
};

type Asset = { id: string; name: string; size: number; at: string };

export default function N8nPanel({ admin, configured, missing, assets }: { admin: boolean; configured: boolean; missing: string; assets: Asset[] }) {
  const toast = useToast();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ name: string; json: string } | null>(null);
  const [importAsset, setImportAsset] = useState<string>('');
  const [importName, setImportName] = useState('');

  useEffect(() => {
    if (!admin || !configured) return;
    let cancelled = false;
    (async () => {
      setLoadErr(null);
      try {
        const res = await fetch('/api/n8n/workflows', { cache: 'no-store' });
        const data = (await res.json()) as { ok: boolean; workflows?: WorkflowSummary[]; error?: string };
        if (cancelled) return;
        if (!data.ok || !data.workflows) setLoadErr(data.error ?? 'Could not load workflows.');
        else setWorkflows(data.workflows);
      } catch {
        if (!cancelled) setLoadErr('Could not load workflows.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [admin, configured]);

  async function view(w: WorkflowSummary) {
    setBusy(`view:${w.id}`);
    try {
      const res = await fetch(`/api/n8n/workflows/${encodeURIComponent(w.id)}`, { cache: 'no-store' });
      const data = (await res.json()) as { ok: boolean; workflow?: { json: unknown }; error?: string };
      if (!data.ok || !data.workflow) {
        toast(data.error ?? 'Could not load workflow JSON.', 'err');
      } else {
        setViewing({ name: w.name, json: JSON.stringify(data.workflow.json, null, 2) });
      }
    } catch {
      toast('Could not load workflow JSON.', 'err');
    }
    setBusy(null);
  }

  async function exportWf(w: WorkflowSummary) {
    setBusy(`export:${w.id}`);
    const res = await exportN8nWorkflow({ workflowId: w.id });
    setBusy(null);
    toast(res.error ?? res.message ?? 'Exported.', res.ok ? 'ok' : 'err');
    if (res.ok) router.refresh();
  }

  async function importWf() {
    if (!importAsset) {
      toast('Pick a JSON file from the library first.', 'err');
      return;
    }
    setBusy('import');
    const res = await importN8nWorkflow({ assetId: importAsset, ...(importName.trim() ? { name: importName.trim() } : {}) });
    setBusy(null);
    toast(res.error ?? res.message ?? 'Imported.', res.ok ? 'ok' : 'err');
    if (res.ok) {
      setImportAsset('');
      setImportName('');
      setWorkflows(null);
      router.refresh();
    }
  }

  if (!admin) {
    return <div className="tablewrap"><div className="empty">n8n workflow management is admin-only.</div></div>;
  }

  const filtered = (workflows ?? []).filter((w) => (q.trim() ? w.name.toLowerCase().includes(q.toLowerCase().trim()) : true));

  return (
    <>
      {!configured ? (
        <div className="tablewrap" style={{ marginBottom: 12 }}>
          <div className="empty">
            n8n is not configured yet — set {missing || 'N8N_BASE_URL and N8N_API_KEY'} in the server env (host n8n yourself or via Railway/Render), then reload.
          </div>
        </div>
      ) : null}

      <div className="tablewrap" style={{ marginBottom: 14 }}>
        <div className="table" style={{ minWidth: 0 }}>
          <div style={{ padding: '14px 14px 10px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--table-line)' }}>
            <div className="ws-search" style={{ minWidth: 220 }}>
              <span aria-hidden="true">⌕</span>
              <input
                placeholder="Search workflows…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search workflows"
              />
            </div>
            <span className="itemsub">{workflows ? `${filtered.length} of ${workflows.length}` : ''}</span>
          </div>
          {loadErr ? <div className="empty" style={{ padding: 22 }}>{loadErr}</div> : null}
          {workflows === null && !loadErr && configured ? <div className="empty" style={{ padding: 22 }}>Loading workflows…</div> : null}
          {workflows !== null && filtered.length === 0 ? <div className="empty" style={{ padding: 22 }}>No workflows in this n8n instance.</div> : null}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="tablewrap" style={{ marginBottom: 14 }}>
          <table className="table">
            <thead>
              <tr><th>Workflow</th><th>ID</th><th>Status</th><th>Nodes</th><th>Updated</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.name}</strong></td>
                  <td><span className="itemsub">{w.id}</span></td>
                  <td><div className="pill" style={w.active ? { color: 'var(--green)' } : undefined}>{w.active ? 'ACTIVE' : 'INACTIVE'}</div></td>
                  <td>{w.nodeCount ?? '—'}</td>
                  <td>{w.updatedAt ? w.updatedAt.slice(0, 16).replace('T', ' ') : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                    <button className="btn sq" onClick={() => view(w)} disabled={busy !== null}>View JSON</button>
                    <button className="btn sq" onClick={() => exportWf(w)} disabled={busy !== null} title="Export into Files library">Export ⇩</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid" style={{ marginTop: 4 }}>
        <section className="card wide">
          <div className="panelhead">
            <h2>Import a workflow JSON from the Files library</h2>
            <span className="quiet">exports land in Files; pick one and push it to n8n as a new workflow</span>
          </div>
          <div className="formgrid">
            <label className="field">
              JSON file (from Files)
              <select value={importAsset} onChange={(e) => setImportAsset(e.target.value)}>
                <option value="">— choose file —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({Math.max(1, Math.round(a.size / 1024))} KB)
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Optional new name
              <input value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Leave empty to use the original" />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn primary" onClick={importWf} disabled={busy !== null || !importAsset}>
              {busy === 'import' ? 'Importing…' : 'Import to n8n'}
            </button>
          </div>
          {assets.length === 0 ? (
            <div className="sub" style={{ marginTop: 8 }}>No JSON files in the library yet — export a workflow above, or upload one on the Files page.</div>
          ) : null}
        </section>
      </div>

      {viewing ? (
        <div className="modalbg" onClick={(e) => { if (e.target === e.currentTarget) setViewing(null); }}>
          <div className="card modal" role="dialog" aria-modal="true" aria-label={`Workflow JSON — ${viewing.name}`} style={{ width: 'min(860px, 94vw)' }}>
            <div className="panelhead">
              <h2>{viewing.name} — workflow JSON</h2>
              <button className="btn sq" onClick={() => setViewing(null)} aria-label="Close JSON view">✕</button>
            </div>
            <div style={{ maxHeight: '55vh', overflow: 'auto' }}>
              <pre style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{viewing.json}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
