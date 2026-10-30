'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';

type PreviewRes = {
  ok: boolean;
  total?: number;
  dupsInDb?: number;
  valid?: { name: string; service: string; estValue: number; contactPerson: string | null }[];
  invalid?: { reason: string }[];
  error?: string;
};
type CommitRes = { ok: boolean; created?: number; duplicates?: number; invalid?: number; error?: string };

export default function LeadCsvImport() {
  const toast = useToast();
  const router = useRouter();
  const [filename, setFilename] = useState('');
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<PreviewRes | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(mode: 'preview' | 'commit'): Promise<PreviewRes & CommitRes> {
    const res = await fetch('/api/import/final', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, filename, csv }),
    });
    return (await res.json()) as PreviewRes & CommitRes;
  }

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      toast('File too large — CSV must be smaller than 2MB.', 'err');
      return;
    }
    setFilename(f.name);
    setCsv(await f.text());
    setPreview(null);
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {preview === null ? (
        <>
          <label className="btn" style={{ cursor: 'pointer' }}>
            ⇪ Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={async (e) => {
                await pick(e.target.files);
              }}
            />
          </label>
          <button
            className="btn"
            disabled={busy || !csv}
            onClick={async () => {
              setBusy(true);
              const res = await post('preview');
              setBusy(false);
              if (res.ok) {
                setPreview(res);
                toast(`Preview: ${res.total} rows · ${res.valid?.length ?? 0} to import · ${res.dupsInDb ?? 0} already in CRM · ${res.invalid?.length ?? 0} invalid.`, 'ok');
              } else {
                toast(res.error ?? 'Preview failed', 'err');
              }
            }}
          >
            {busy ? 'Parsing…' : 'Preview file'}
          </button>
        </>
      ) : (
        <>
          <span className="pill">
            {filename}: {preview.total} rows · {preview.valid?.length ?? 0} to import · {preview.dupsInDb} already exist
          </span>
          <button
            className="btn"
            disabled={busy || (preview.valid?.length ?? 0) === 0}
            onClick={async () => {
              setBusy(true);
              const res = await post('commit');
              setBusy(false);
              if (res.ok) {
                toast(`Imported ${res.created ?? 0} leads · ${res.duplicates ?? 0} duplicates skipped · ${res.invalid ?? 0} invalid`, 'ok');
                setPreview(null);
                setCsv('');
                router.refresh();
              } else {
                toast(res.error ?? 'Commit failed', 'err');
              }
            }}
          >
            Import {preview.valid?.length ?? 0} leads
          </button>
          <button className="btn sq" disabled={busy} onClick={() => { setPreview(null); setCsv(''); }} title="Cancel" aria-label="Cancel import">✕</button>
        </>
      )}
    </span>
  );
}
