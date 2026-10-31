'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import * as XLSX from 'xlsx';

type PreviewRes = {
  ok: boolean;
  total?: number;
  columns?: string[];
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
  const [assetId, setAssetId] = useState('');

  async function post(mode: 'draft' | 'preview' | 'commit', values?: { filename?: string; csv?: string }): Promise<PreviewRes & CommitRes & { assetId?: string }> {
    const res = await fetch('/api/import/final', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, filename: values?.filename ?? filename, csv: values?.csv ?? csv, assetId: assetId || undefined }),
    });
    const text = await res.text();
    let payload: Partial<PreviewRes & CommitRes> = {};
    if (text) {
      try {
        payload = JSON.parse(text) as Partial<PreviewRes & CommitRes>;
      } catch {
        throw new Error(`Import endpoint returned invalid data (HTTP ${res.status}).`);
      }
    }
    if (!res.ok) throw new Error(payload.error ?? `Import failed (HTTP ${res.status}).`);
    return payload as PreviewRes & CommitRes;
  }

  async function postDraft(nextFilename: string, nextCsv: string) {
    return post('draft', { filename: nextFilename, csv: nextCsv });
  }

  async function runImport(mode: 'preview' | 'commit') {
    setBusy(true);
    try {
      return await post(mode);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Import failed.', 'err');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      toast('File too large — CSV and Excel files must be smaller than 2MB.', 'err');
      return;
    }
    setFilename(f.name);
    let convertedCsv: string;
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      const workbook = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      convertedCsv = XLSX.utils.sheet_to_csv(firstSheet);
    } else {
      convertedCsv = await f.text();
    }
    setCsv(convertedCsv);
    setPreview(null);
    setBusy(true);
    try {
      const result = await postDraft(f.name, convertedCsv);
      setAssetId(result.assetId ?? '');
      if (result.ok) {
        setPreview(result);
        toast(`Preview: ${result.total} rows · ${result.valid?.length ?? 0} to import · ${result.dupsInDb ?? 0} already in CRM · ${result.invalid?.length ?? 0} invalid.`, 'ok');
      }
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save draft.', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {preview === null ? (
        <>
          <label className="btn" style={{ cursor: 'pointer' }}>
            ⇪ Import CSV / Excel
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
              const res = await runImport('preview');
              if (!res) return;
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
          {preview.columns?.length ? <span className="sub">Mapped columns: {preview.columns.join(', ')}</span> : null}
          <button
            className="btn"
            disabled={busy || (preview.valid?.length ?? 0) === 0}
            onClick={async () => {
              const res = await runImport('commit');
              if (!res) return;
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
