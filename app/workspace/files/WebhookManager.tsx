'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/app/workspace/Shell';

type Delivery = {
  id: string;
  filename: string | null;
  size: number | null;
  status: string;
  error: string | null;
  receivedAt: string;
  fileAssetId: string | null;
};
type Webhook = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  ownerId: string | null;
  lastTriggeredAt: string | null;
  fileCount: number;
  deliveries: Delivery[];
};

function bytes(size: number | null): string {
  if (size === null) return '—';
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

function date(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-GB') : 'Never';
}

export default function WebhookManager() {
  const toast = useToast();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [newUrl, setNewUrl] = useState('');

  async function load() {
    const res = await fetch('/api/webhooks', { cache: 'no-store' });
    const data = (await res.json()) as { ok?: boolean; error?: string; webhooks?: Webhook[] };
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not load webhooks.');
    setWebhooks(data.webhooks ?? []);
  }

  useEffect(() => {
    load().catch((error) => toast(error instanceof Error ? error.message : 'Could not load webhooks.', 'err'));
  }, [toast]);

  function resetForm() {
    setEditing(null);
    setName('');
    setDescription('');
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(editing ? `/api/webhooks/${editing}` : '/api/webhooks', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, description: description || null, enabled: true }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; url?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not save webhook.');
      if (data.url) setNewUrl(data.url);
      resetForm();
      await load();
      toast(editing ? 'Webhook updated.' : 'Webhook created.', 'ok');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save webhook.', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, patch: { enabled?: boolean; regenerateSecret?: boolean }) {
    const current = webhooks.find((webhook) => webhook.id === id);
    if (!current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: current.name, description: current.description, enabled: current.enabled, ...patch }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; url?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not update webhook.');
      if (data.url) setNewUrl(data.url);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update webhook.', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this webhook and its delivery history? Received files will remain in Files.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not delete webhook.');
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete webhook.', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast('Webhook URL copied.', 'ok');
  }

  return (
    <>
      <button className="btn" type="button" onClick={() => setOpen(true)}>Manage webhooks</button>
      {open ? (
        <div className="modalbg" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="card modal" role="dialog" aria-modal="true" aria-label="Webhook management" style={{ maxWidth: 900 }}>
            <div className="panelhead">
              <div><h2>Webhook management</h2><div className="sub">Create one endpoint per workflow. Secrets are only shown when generated.</div></div>
              <button className="btn sq" type="button" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            {newUrl ? (
              <div className="panel" style={{ marginBottom: 14 }}>
                <strong>New webhook URL</strong>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input readOnly value={newUrl} aria-label="New webhook URL" />
                  <button className="btn" type="button" onClick={() => copy(newUrl)}>Copy</button>
                </div>
                <div className="sub" style={{ marginTop: 6 }}>Save this URL now. Regenerating it invalidates the previous URL.</div>
              </div>
            ) : null}
            <div className="panel" style={{ marginBottom: 14 }}>
              <h3 style={{ marginTop: 0 }}>{editing ? 'Edit webhook' : 'Create webhook'}</h3>
              <div className="formgrid">
                <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="n8n lead generation" /></label>
                <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Source and purpose" /></label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn primary" type="button" onClick={save} disabled={busy || !name.trim()}>{editing ? 'Save changes' : 'Create webhook'}</button>
                {editing ? <button className="btn" type="button" onClick={resetForm}>Cancel</button> : null}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 12, maxHeight: '55vh', overflow: 'auto' }}>
              {webhooks.length === 0 ? <div className="empty">No webhooks configured yet.</div> : webhooks.map((webhook) => (
                <div className="panel" key={webhook.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div><h3 style={{ margin: 0 }}>{webhook.name}</h3><div className="sub">{webhook.description || 'No description'}</div></div>
                    <span className="pill">{webhook.enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div className="sub" style={{ marginTop: 8 }}>Files: {webhook.fileCount} · Last triggered: {date(webhook.lastTriggeredAt)}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    <button className="btn sq" type="button" onClick={() => update(webhook.id, { enabled: !webhook.enabled })} disabled={busy}>{webhook.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="btn sq" type="button" onClick={() => { setEditing(webhook.id); setName(webhook.name); setDescription(webhook.description ?? ''); }} disabled={busy}>Edit</button>
                    <button className="btn sq" type="button" onClick={() => update(webhook.id, { regenerateSecret: true })} disabled={busy}>Regenerate URL</button>
                    <button className="btn sq" type="button" onClick={() => remove(webhook.id)} disabled={busy}>Delete</button>
                  </div>
                  <div style={{ marginTop: 12, overflowX: 'auto' }}>
                    <table className="table"><thead><tr><th>Received</th><th>File</th><th>Size</th><th>Status</th><th>Error</th></tr></thead>
                      <tbody>{webhook.deliveries.length === 0 ? <tr><td colSpan={5} className="empty">No deliveries.</td></tr> : webhook.deliveries.map((delivery) => <tr key={delivery.id}><td>{date(delivery.receivedAt)}</td><td>{delivery.fileAssetId ? <a href={`/api/files/${delivery.fileAssetId}`} style={{ color: 'var(--purple)' }}>{delivery.filename}</a> : delivery.filename ?? '—'}</td><td>{bytes(delivery.size)}</td><td><span className="pill">{delivery.status}</span></td><td>{delivery.error ?? '—'}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
