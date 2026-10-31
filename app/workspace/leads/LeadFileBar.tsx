'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format';
import { useToast } from '@/app/workspace/Shell';

type Dataset = {
  id: string;
  fileName: string;
  mimeType: string;
  leadCount: number;
  modifiedAt: string;
  active: boolean;
};

export default function LeadFileBar({ datasets }: { datasets: Dataset[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState('');

  async function select(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch('/api/lead/workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ datasetId: id }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not open file.');
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not open file.', 'err');
    } finally {
      setBusy('');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this draft from Leads? Its imported leads will remain preserved.')) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/lead/workspace?datasetId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not remove draft.');
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not remove draft.', 'err');
    } finally {
      setBusy('');
    }
  }

  if (!datasets.length) return null;
  return (
    <section className="panel" aria-label="Lead files" style={{ marginBottom: 14, padding: 12 }}>
      <div className="panelhead" style={{ marginBottom: 8 }}>
        <div><strong>Lead files</strong><div className="sub">Each file has its own independent lead list.</div></div>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {datasets.map((file) => (
          <div key={file.id} style={{ minWidth: 220, border: `1px solid ${file.active ? 'var(--acid)' : 'var(--line)'}`, borderRadius: 10, padding: 10, background: file.active ? 'rgba(190,255,0,.08)' : 'var(--panel2)' }}>
            <button type="button" onClick={() => select(file.id)} disabled={Boolean(busy)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.fileName}</strong>
              <span className="itemsub">{file.mimeType} · {file.leadCount} leads</span>
              <span className="itemsub" style={{ display: 'block' }}>{formatDate(file.modifiedAt)} · {file.active ? 'Active' : 'Draft'}</span>
            </button>
            {!file.active ? <button className="btn sq" type="button" onClick={() => remove(file.id)} disabled={Boolean(busy)} title="Remove draft" style={{ marginTop: 8 }}>✕</button> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
