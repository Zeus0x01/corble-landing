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
  assetId?: string;
  datasetId?: string;
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

  async function post(
    mode: 'draft' | 'preview' | 'commit',
    values?: { filename?: string; csv?: string }
  ): Promise<PreviewRes & CommitRes> {
    const res = await fetch('/api/import/final', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode,
        filename: values?.filename ?? filename,
        csv: values?.csv ?? csv,
        assetId: assetId || undefined,
      }),
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

  /** Step 1 – Upload: always creates a brand-new independent draft */
  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      toast('File too large — CSV and Excel files must be smaller than 2MB.', 'err');
      return;
    }

    setFilename(f.name);
    setPreview(null);
    setAssetId(''); // force new draft

    let convertedCsv: string;
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      const workbook = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      convertedCsv = XLSX.utils.sheet_to_csv(firstSheet);
    } else {
      convertedCsv = await f.text();
    }
    setCsv(convertedCsv);

    setBusy(true);
    try {
      // mode: 'draft' → creates new fileAsset + leadDataset, sets it active
      const result = await post('draft', { filename: f.name, csv: convertedCsv });
      setAssetId(result.assetId ?? '');

      if (result.ok) {
        setPreview(result);
        toast(
          `Draft created: ${result.total} rows · ${result.valid?.length ?? 0} ready · ${result.dupsInDb ?? 0} already in CRM · ${result.invalid?.length ?? 0} invalid.`,
          'ok'
        );
      }
      // Refresh so the new draft appears immediately in the horizontal bar
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create draft.', 'err');
    } finally {
      setBusy(false);
    }
  }

  function cancelReview() {
    // Only clears the local review UI. The draft stays in the horizontal bar.
    setPreview(null);
    setCsv('');
    setFilename('');
    setAssetId('');
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {preview === null ? (
        <>
          <label className="btn" style={{ cursor: 'pointer' }}>
            ⇪ Upload CSV / Excel
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              style={{ display: 'none' }}
              onChange={async (e) => {
                await pick(e.target.files);
                // reset input so the same file can be selected again later
                e.target.value = '';
              }}
            />
          </label>
        </>
      ) : (
        <>
          <span className="pill" title="This is a draft — nothing is imported yet">
            {filename}: {preview.total} rows · {preview.valid?.length ?? 0} ready · {preview.dupsInDb ?? 0} already exist
          </span>

          {preview.columns?.length ? (
            <span className="sub">Detected: {preview.columns.join(', ')}</span>
          ) : null}

          <button
            className="btn primary"
            disabled={busy || (preview.valid?.length ?? 0) === 0}
            onClick={async () => {
              const res = await runImport('commit');
              if (!res) return;
              if (res.ok) {
                toast(
                  `Imported ${res.created ?? 0} leads · ${res.duplicates ?? 0} duplicates skipped · ${res.invalid ?? 0} invalid`,
                  'ok'
                );
                cancelReview();
                router.refresh();
              } else {
                toast(res.error ?? 'Import failed', 'err');
              }
            }}
          >
            {busy ? 'Importing…' : `Import ${preview.valid?.length ?? 0} leads`}
          </button>

          <button
            className="btn sq"
            disabled={busy}
            onClick={cancelReview}
            title="Close review (draft stays in the file bar)"
            aria-label="Close review"
          >
            ✕
          </button>
        </>
      )}
    </span>
  );
}
