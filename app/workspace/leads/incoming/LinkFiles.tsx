'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { linkCompanies, unlinkCompanies } from '@/lib/actions';

export type IncomingFileLink = { linkId: string; assetId: string; label: string; home: string };
export type LibraryFile = { assetId: string; label: string; home: string };

export default function LinkFiles({
  leadId,
  leadLabel,
  links,
  files,
}: {
  leadId: string;
  leadLabel: string;
  links: IncomingFileLink[];
  files: LibraryFile[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [current, setCurrent] = useState<IncomingFileLink[]>(links);

  const list = useMemo(
    () => files.filter((f) => f.label.toLowerCase().includes(search.toLowerCase())),
    [files, search]
  );

  function reset() {
    setCurrent(links);
    setSearch('');
  }

  function isLinked(assetId: string) {
    return current.some((l) => l.assetId === assetId);
  }

  function toggle(assetId: string, label: string, home: string) {
    const found = current.find((l) => l.assetId === assetId);
    setCurrent((prev) => {
      if (found) return prev.filter((l) => l.linkId !== found.linkId);
      return [...prev, { linkId: `new:${assetId}`, assetId, label, home }];
    });
  }

  async function save() {
    setBusy(true);
    const msgs: string[] = [];
    let err = '';
    let okAll = true;
    const added = current.filter((l) => l.linkId.startsWith('new:'));
    const removedLinks = links.filter((l) => !current.some((c) => c.linkId === l.linkId)).map((l) => l.linkId);
    const byAsset = new Map<string, { added: { linkId: string; assetId: string; label: string; home: string }[]; removed: string[] }>();
    for (const a of added) {
      const e = byAsset.get(a.assetId) ?? { added: [], removed: [] };
      e.added.push(a);
      byAsset.set(a.assetId, e);
    }
    for (const linkId of removedLinks) {
      const l = links.find((x) => x.linkId === linkId)!;
      const e = byAsset.get(l.assetId) ?? { added: [], removed: [] };
      e.removed.push(linkId);
      byAsset.set(l.assetId, e);
    }
    for (const [assetId, { added: adds, removed: rems }] of byAsset) {
      if (adds.length) {
        const res = await linkCompanies({ assetId, companies: [{ kind: 'INCOMING', id: leadId }] });
        okAll = okAll && res.ok;
        if (res.error) err = res.error;
        else if (res.message) msgs.push(res.message);
      }
      if (rems.length) {
        const res = await unlinkCompanies({ assetId, linkIds: rems });
        okAll = okAll && res.ok;
        if (res.error) err = res.error;
        else if (res.message) msgs.push(res.message);
      }
    }
    setBusy(false);
    if (okAll) {
      if (msgs.length === 0) msgs.push('No changes.');
      toast(msgs.filter(Boolean).join(' '), 'ok');
      setOpen(false);
      reset();
      router.refresh();
    } else {
      toast(err || 'Failed to update files.', 'err');
    }
  }

  const linkedCount = current.length;

  return (
    <>
      <button className="btn sq" title="Link files to this incoming lead" aria-label={`Files for ${leadLabel}`} onClick={() => setOpen(true)}>
        ▤ {linkedCount > 0 ? linkedCount : ''}
      </button>
      {open ? (
        <div className="modalbg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="card modal" role="dialog" aria-modal="true" aria-label={`Files ${leadLabel}`}>
            <div className="panelhead">
              <h2>Files — {leadLabel}</h2>
              <button className="btn sq" onClick={() => { setOpen(false); reset(); }} aria-label="Close dialog">✕</button>
            </div>
            <div className="sub" style={{ marginTop: 2, marginBottom: 10 }}>
              Pick files from the shared Files library. Linked files show on this lead and in the Files tab (Incoming section).
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
              <input className="textinput" style={{ flex: 1 }} placeholder="Search files…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            </div>
            <div className="modal-typelist" style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 6 }}>
              {list.length === 0 ? (
                <div className="sub" style={{ padding: 10 }}>No files match — upload in the Files tab, then link here.</div>
              ) : (
                list.map((f) => (
                  <label key={f.assetId} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={isLinked(f.assetId)} onChange={() => toggle(f.assetId, f.label, f.home)} />
                    <span style={{ fontSize: 13 }}>{f.label}</span>
                    {f.home ? <span className="itemsub">{f.home}</span> : null}
                  </label>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => { setOpen(false); reset(); }}>Cancel</button>
              <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'} {linkedCount > 0 ? `(${linkedCount} linked)` : ''}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
