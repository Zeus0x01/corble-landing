'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import type { FieldSpec } from '@/lib/validators';

type Action = (raw: unknown) => Promise<{ ok: boolean; error?: string; message?: string }>;

export default function ModalForm({
  title,
  fields,
  action,
  trigger,
  triggerClass = 'btn primary',
  hidden = {},
}: {
  title: string;
  fields: FieldSpec[];
  action: Action;
  trigger: string;
  triggerClass?: string;
  hidden?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = { ...hidden };
    fd.forEach((v, k) => {
      data[k] = String(v);
    });
    const res = await action(data);
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? 'Failed.', 'err');
      return;
    }
    setOpen(false);
    toast(res.message ?? 'Saved.');
    router.refresh();
  }

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)}>{trigger}</button>
      {open && (
        <div className="modalbg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form onSubmit={submit} className="card modal" role="dialog" aria-modal="true" aria-label={title}>
            <div className="panelhead">
              <h2>{title}</h2>
              <button type="button" className="btn sq" onClick={() => setOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <div className="formgrid">
              {fields.map((f) => (
                <label key={f.name} className={`field${f.full ? ' full' : ''}`}>
                  {f.label}
                  {f.type === 'select' ? (
                    <select name={f.name} required={f.required} defaultValue={String(f.value ?? '')}>
                      <option value="">Choose…</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={f.name}
                      type={f.type ?? 'text'}
                      required={f.required}
                      defaultValue={f.value}
                      placeholder={f.placeholder}
                    />
                  )}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
