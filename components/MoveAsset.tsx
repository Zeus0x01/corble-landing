'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { moveFile, linkCompanies, unlinkCompanies } from '@/lib/actions';

export type HomeKind = 'library' | 'project' | 'task';
export type Target = { id: string; label: string };
export type Company = { id: string; label: string; kind: 'LEAD' | 'INCOMING' };
export type Link = Company & { linkId: string };

export default function MoveAsset({
  assetId,
  assetName,
  home,
  links,
  projects,
  tasks,
  leads,
  incoming,
  compact,
}: {
  assetId: string;
  assetName: string;
  home: { kind: HomeKind; id?: string };
  links: Link[];
  projects: Target[];
  tasks: Target[];
  leads: Company[];
  incoming: Company[];
  compact?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [homeKind, setHomeKind] = useState<HomeKind>(home.kind);
  const [homeId, setHomeId] = useState(home.id ?? '');
  const [initial] = useState<Set<string>>(() => new Set(links.map((l) => l.linkId)));
  const [rels, setRels] = useState<Map<string, Company>>(() => new Map(links.map((l) => [l.linkId, l])));
  const [tab, setOpenTab] = useState<'LEAD' | 'INCOMING'>('LEAD');
  const [search, setSearch] = useState('');

  const companyOptions = useMemo(
    () => (tab === 'LEAD' ? leads : incoming).filter((c) => c.label.toLowerCase().includes(search.toLowerCase())),
    [tab, leads, incoming, search]
  );

  function toggleCompany(c: Company) {
    setRels((prev) => {
      const n = new Map(prev);
      const found = [...n.entries()].find(([, v]) => v.kind === c.kind && v.id === c.id);
      if (found) n.delete(found[0]);
      else n.set(`new:${c.kind}:${c.id}`, c);
      return n;
    });
  }
  function isLinked(c: Company) {
    return [...rels.values()].some((v) => v.kind === c.kind && v.id === c.id);
  }

  function reset() {
    setHomeKind(home.kind);
    setHomeId(home.id ?? '');
    setRels(new Map(links.map((l) => [l.linkId, l])));
    setSearch('');
  }

  async function save() {
    setBusy(true);
    const msgs: string[] = [];
    let err = '';
    let ok = true;
    if (homeKind !== home.kind || (homeKind !== 'library' && homeId !== home.id)) {
      const res = await moveFile({
        assetId,
        projectId: homeKind === 'project' ? homeId || null : null,
        taskId: homeKind === 'task' ? homeId || null : null,
      });
      ok = ok && res.ok;
      if (res.error) err = res.error;
      else if (res.message) msgs.push(res.message);
    }
    const current: Company[] = [...rels.values()];
    const added = current.filter((c) => !links.some((l) => l.kind === c.kind && l.id === c.id));
    const removed = links.filter((l) => !current.some((c) => c.kind === l.kind && c.id === l.id)).map((l) => l.linkId);
    if (added.length) {
      const res = await linkCompanies({ assetId, companies: added });
      ok = ok && res.ok;
      if (res.error) err = res.error;
      else if (res.message) msgs.push(res.message);
    }
    if (removed.length) {
      const res = await unlinkCompanies({ assetId, linkIds: removed });
      ok = ok && res.ok;
      if (res.error) err = res.error;
      else if (res.message) msgs.push(res.message);
    }
    setBusy(false);
    if (ok) {
      toast(msgs.filter(Boolean).join(' ') || 'No changes.', 'ok');
      setOpen(false);
      reset();
      router.refresh();
    } else {
      toast(err || 'Failed.', 'err');
    }
  }

  const dirty =
    homeKind !== home.kind ||
    (homeKind !== 'library' && home.id !== homeId) ||
    rels.size !== initial.size ||
    [...rels.values()].some((c) => !(c as Link).linkId) ||
    links.some((l) => !rels.has(l.linkId));

  function markHome(k: HomeKind) {
    setHomeKind(k);
    if (k === 'library') setHomeId('');
  }

  return (
    <>
      <button className={compact ? 'btn sq' : 'btn'} disabled={busy} onClick={() => setOpen(true)} title={`Move / link ${assetName}`}>
        ⇄
      </button>
      {open ? (
        <div className="modalbg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="card modal" role="dialog" aria-modal="true" aria-label={`Move ${assetName}`}>
            <div className="panelhead">
              <h2>Move "{assetName}"</h2>
              <button className="btn sq" onClick={() => { setOpen(false); reset(); }} aria-label="Close dialog">✕</button>
            </div>

            <div className="sub" style={{ marginTop: 2, marginBottom: 10 }}>
              One home in the workspace + any number of linked companies.
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <strong style={{ fontSize: 12 }}>Home:</strong>
              <button className={`btn sq${homeKind === 'library' ? ' primary' : ''}`} onClick={() => markHome('library')}>Library</button>
              <button className={`btn sq${homeKind === 'project' ? ' primary' : ''}`} onClick={() => markHome('project')}>Project</button>
              <button className={`btn sq${homeKind === 'task' ? ' primary' : ''}`} onClick={() => markHome('task')}>Task</button>
              {homeKind !== 'library' ? (
                <select style={{ flex: 1, minWidth: 180 }} value={homeId} onChange={(e) => setHomeId(e.target.value)}>
                  <option value="">— choose {homeKind} —</option>
                  {(homeKind === 'project' ? projects : tasks).map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              ) : null}
            </div>

            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 12 }}>Companies ({rels.size} linked)</strong>
              {rels.size > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                  {[...rels.entries()].map(([key, c]) => (
                    <span key={key} className="pill" style={{ color: c.kind === 'INCOMING' ? 'var(--orange)' : 'var(--acid)', cursor: 'default' }}>
                      {(c as Link).linkId ? '' : '+ '}{c.label}
                      {!busy ? (
                        <button
                          style={{ all: 'unset', cursor: 'pointer', fontWeight: 700 }}
                          aria-label={`Unlink ${c.label}`}
                          onClick={() => {
                            setRels((prev) => {
                              const n = new Map(prev);
                              n.delete(key);
                              return n;
                            });
                          }}
                        > ✕</button>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="sub" style={{ margin: '6px 0' }}>No companies linked.</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button className={`btn sq${tab === 'LEAD' ? ' primary' : ''}`} onClick={() => setOpenTab('LEAD')} type="button">Leads ({leads.length})</button>
                <button className={`btn sq${tab === 'INCOMING' ? ' primary' : ''}`} onClick={() => setOpenTab('INCOMING')} type="button">Incoming ({incoming.length})</button>
                <input className="textinput" style={{ flex: 1 }} placeholder="Search companies…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="modal-typelist" style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 6 }}>
                {companyOptions.length === 0 ? (
                  <div className="sub" style={{ padding: 10 }}>No {tab === 'LEAD' ? 'leads' : 'incoming leads'} match.</div>
                ) : (
                  companyOptions.map((c) => (
                    <label key={c.kind + c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={isLinked(c)} onChange={() => toggleCompany(c)} />
                      <span style={{ fontSize: 13 }}>{c.label}</span>
                      {c.kind === 'INCOMING' ? <span className="itemsub">incoming</span> : null}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => { setOpen(false); reset(); }}>Cancel</button>
              <button className="btn primary" disabled={busy || !dirty} onClick={save}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
