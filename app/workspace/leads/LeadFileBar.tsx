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
    <section className="panel" aria-label="Lead files" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
      <div className="tablewrap" style={{ margin: 0 }}>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>LEAD FILES</th>
              <th>ROWS</th>
              <th>CREATED</th>
              <th>STATUS</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((file) => {
              const isPureDraft = file.leadCount === 0;
              const statusLabel = file.active
                ? isPureDraft
                  ? 'Active · Draft'
                  : 'Active'
                : isPureDraft
                  ? 'Draft'
                  : 'Imported';

              return (
                <tr
                  key={file.id}
                  style={{
                    background: file.active ? 'rgba(190,255,0,.06)' : undefined,
                    cursor: busy ? 'wait' : 'pointer',
                  }}
                  onClick={() => !busy && select(file.id)}
                >
                  <td>
                    <strong style={{ display: 'block' }}>{file.fileName}</strong>
                    <span className="itemsub">
                      {file.mimeType.includes('csv') || file.fileName.toLowerCase().endsWith('.csv')
                        ? 'text/csv'
                        : file.mimeType}
                    </span>
                  </td>
                  <td>
                    {file.leadCount === 0 ? (
                      <span className="itemsub">0 leads</span>
                    ) : (
                      <>
                        {file.leadCount} lead{file.leadCount === 1 ? '' : 's'}
                      </>
                    )}
                  </td>
                  <td>
                    <span className="itemsub">{formatDate(file.modifiedAt)}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        color: file.active
                          ? 'var(--acid)'
                          : isPureDraft
                            ? 'var(--muted)'
                            : 'inherit',
                        fontWeight: file.active ? 600 : 400,
                      }}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {!file.active && (
                      <button
                        className="btn sq"
                        type="button"
                        onClick={() => remove(file.id)}
                        disabled={Boolean(busy)}
                        title="Remove this draft (imported leads stay)"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
