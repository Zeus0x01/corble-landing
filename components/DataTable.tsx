'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';

export type DtVal = string | number | null;
export type DtRow = { id: string; vals: Record<string, DtVal>; cells: ReactNode[] };
export type DtColumn = { key?: string; label: string };
export type DtBulk = {
  label: string;
  action: (raw: unknown) => Promise<{ ok: boolean; error?: string; message?: string }>;
  confirm?: string;
  danger?: boolean;
};

export default function DataTable({
  columns,
  rows,
  bulk,
  empty,
}: {
  columns: DtColumn[];
  rows: DtRow[];
  bulk?: DtBulk[];
  empty: string;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a.vals[sortKey] ?? null;
      const bv = b.vals[sortKey] ?? null;
      const an = av === '' || av === null;
      const bn = bv === '' || bv === null;
      if (an && bn) return 0;
      if (an) return 1;
      if (bn) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true }) * dir;
    });
    return arr;
  }, [rows, sortKey, dir]);

  const ids = [...sel];
  const allSelected = sorted.length > 0 && ids.length === sorted.length;

  function toggleAll() {
    setSel(allSelected ? new Set() : new Set(sorted.map((r) => r.id)));
  }
  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function clickSort(key: string) {
    if (sortKey === key) {
      if (dir === 1) setDir(-1);
      else {
        setSortKey(null);
        setDir(1);
      }
    } else {
      setSortKey(key);
      setDir(1);
    }
  }
  async function runBulk(b: NonNullable<(typeof bulk)>[number]) {
    setBusy(true);
    const res = await b.action(ids);
    setBusy(false);
    toast(res.error ?? res.message ?? (res.ok ? 'Done.' : 'Failed'), res.ok ? 'ok' : 'err');
    if (res.ok) {
      setSel(new Set());
      router.refresh();
    }
  }

  return (
    <div className="tablewrap">
      {ids.length > 0 && (bulk?.length ?? 0) > 0 ? (
        <div className="selbar" role="toolbar" aria-label="Bulk actions">
          <strong>{ids.length} selected</strong>
          {bulk?.map((b) => (
            <button
              key={b.label}
              className={`btn sq${b.danger ? ' danger' : ''}`}
              disabled={busy}
              onClick={() => {
                if (b.confirm) {
                  if (!window.confirm(b.confirm) ) return;
                  void runBulk(b);
                } else void runBulk(b);
              }}
            >
              {b.label}
            </button>
          ))}
          <button className="btn sq" disabled={busy} onClick={() => setSel(new Set())}>Clear</button>
        </div>
      ) : null}
      <table className="table">
        <thead>
          <tr>
            <th className="selcol">
              <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={toggleAll} />
            </th>
            {columns.map((c, i) => (
              <th
                key={c.key ?? i}
                className={c.key ? 'sortable' : undefined}
                onClick={c.key ? () => clickSort(c.key as string) : undefined}
                title={c.key ? 'Toggle sort (click ↔ reverse ↳ off)' : undefined}
              >
                {c.label}
                {c.key && sortKey === c.key ? <span aria-hidden> {dir === 1 ? '▲' : '▼'}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length + 1} className="empty">{empty}</td></tr>
          ) : (
            sorted.map((r) => (
              <tr key={r.id} className={sel.has(r.id) ? 'selrow' : undefined}>
                <td className="selcol">
                  <input type="checkbox" aria-label={`Select row ${r.id}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                {r.cells.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
