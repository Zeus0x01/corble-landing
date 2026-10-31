'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';

type Preview = {
  ok: boolean;
  total?: number;
  columns?: string[];
  dupsInDb?: number;
  valid?: { name: string; email: string | null; phone: string | null; city: string | null; country: string | null }[];
  invalid?: { reason: string }[];
  error?: string;
};

export default function FileLeadImport({ assetId, fileName }: { assetId: string; fileName: string }) {
  const toast = useToast();
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(mode: 'preview' | 'commit') {
    setBusy(true);
    try {
      const res = await fetch('/api/import/final', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId, filename: fileName, mode }),
      });
      const text = await res.text();
      const data = (text ? JSON.parse(text) : {}) as Preview & { created?: number; duplicates?: number; invalid?: number; datasetId?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Import failed (HTTP ${res.status}).`);
      if (mode === 'preview') {
        setPreview(data);
        toast(`Preview ready: ${data.valid?.length ?? 0} valid, ${data.dupsInDb ?? 0} duplicates, ${data.invalid?.length ?? 0} invalid.`, 'ok');
      } else {
        toast(`Imported ${data.created ?? 0} leads · ${data.duplicates ?? 0} duplicates skipped.`, 'ok');
        setPreview(null);
        router.push('/workspace/leads');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Import failed.', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn sq" onClick={() => run('preview')} disabled={busy} title="Preview this CSV or Excel file for Final Leads">
        {busy && !preview ? '…' : '⇧ Final Leads'}
      </button>
      {preview ? (
        <div className="modalbg" onClick={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
          <div className="card modal" role="dialog" aria-modal="true" aria-label={`Import ${fileName} to Final Leads`}>
            <div className="panelhead">
              <div>
                <h2>Import file to Final Leads</h2>
                <div className="sub">{fileName}</div>
              </div>
              <button className="btn sq" onClick={() => setPreview(null)} aria-label="Close import preview">✕</button>
            </div>
            <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 14 }}>
              <div className="kpi"><div className="klabel">Rows</div><div className="num">{preview.total ?? 0}</div></div>
              <div className="kpi"><div className="klabel">Ready</div><div className="num">{preview.valid?.length ?? 0}</div></div>
              <div className="kpi"><div className="klabel">Duplicates / invalid</div><div className="num">{preview.dupsInDb ?? 0} <small>/ {preview.invalid?.length ?? 0}</small></div></div>
            </div>
            {preview.columns?.length ? <div className="sub">Detected fields: {preview.columns.join(', ')}</div> : null}
            {preview.valid?.length ? (
              <div className="tablewrap" style={{ marginTop: 12, maxHeight: 230, overflow: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Company</th><th>Email</th><th>Phone</th><th>Location</th></tr></thead>
                  <tbody>{preview.valid.slice(0, 10).map((row, index) => <tr key={`${row.name}-${index}`}><td>{row.name}</td><td>{row.email ?? '—'}</td><td>{row.phone ?? '—'}</td><td>{[row.city, row.country].filter(Boolean).join(', ') || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => setPreview(null)} disabled={busy}>Cancel</button>
              <button className="btn primary" onClick={() => run('commit')} disabled={busy || (preview.valid?.length ?? 0) === 0}>
                {busy ? 'Importing…' : `Import ${preview.valid?.length ?? 0} to Final Leads`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
