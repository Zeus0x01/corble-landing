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
      <div className="panelhead" style={{ marginBottom: 10 }}>
        <div>
          <strong>Lead files</strong>
          <div className="sub">Each file is an independent list. Switch freely — columns stay the same.</div>
        </div>
        <div className="sub" style={{ whiteSpace: 'nowrap' }}>
          {datasets.length} file{datasets.length === 1 ? '' : 's'}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'thin',
        }}
      >
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
            <div
              key={file.id}
              style={{
                minWidth: 230,
                maxWidth: 280,
                flex: '0 0 auto',
                border: `1px solid ${file.active ? 'var(--acid)' : 'var(--line)'}`,
                borderRadius: 10,
                padding: '10px 12px',
                background: file.active ? 'rgba(190,255,0,.08)' : 'var(--panel2)',
                position: 'relative',
              }}
            >
              <button
                type="button"
                onClick={() => select(file.id)}
                disabled={Boolean(busy)}
                style={{
                  all: 'unset',
                  cursor: busy ? 'wait' : 'pointer',
                  display: 'block',
                  width: '100%',
                }}
                title={file.active ? 'Currently viewing this file' : 'Switch to this file'}
              >
                <strong
                  style={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 4,
                  }}
                >
                  {file.fileName}
                </strong>

                <span className="itemsub" style={{ display: 'block' }}>
                  {file.mimeType.includes('csv') || file.fileName.toLowerCase().endsWith('.csv')
                    ? 'text/csv'
                    : file.mimeType}{' '}
                  · {file.leadCount} lead{file.leadCount === 1 ? '' : 's'}
                </span>

                <span className="itemsub" style={{ display: 'block', marginTop: 2 }}>
                  {formatDate(file.modifiedAt)} ·{' '}
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
                </span>
              </button>

              {!file.active && (
                <button
                  className="btn sq"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(file.id);
                  }}
                  disabled={Boolean(busy)}
                  title="Remove this draft (imported leads stay)"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    opacity: 0.7,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
