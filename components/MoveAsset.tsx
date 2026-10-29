'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { moveFile } from '@/lib/actions';

type Target = { id: string; label: string;

};

export default function MoveAsset({
  assetId,
  assetName,
  current,
  projects,
  tasks,
  leads,
  compact,
}: {
  assetId: string;
  assetName: string;
  current: string;
  projects: Target[];
  tasks: Target[];
  leads: Target[];
  compact?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<'none' | 'project' | 'task' | 'lead'>('none');
  const [targetId, setTargetId] = useState('');

  useEffect(() => {
    if (!open) {
      setKind('none');
      setTargetId('');
    }
  }, [open]);

  function parseCurrent(c: string): { kind: 'none' | 'project' | 'task' | 'lead'; id: string } {
    const map: Record<string, string> = {};
    for (const part of c.split('|')) {
      const i = part.indexOf(':');
      if (i > 0) map[part.slice(0, i)] = part.slice(i + 1);
    }
    if (map.lead) return { kind: 'lead', id: map.lead };
    if (map.task) return { kind: 'task', id: map.task };
    if (map.project) return { kind: 'project', id: map.project };
    return { kind: 'none', id: '' };
  }

  function pick(k: 'none' | 'project' | 'task' | 'lead') {
    setKind(k);
    const cur = parseCurrent(current);
    setTargetId(cur.kind === k ? cur.id : '');
  }

  async function save() {
    setBusy(true);
    const target =
      kind === 'none'
        ? { projectId: null, taskId: null, leadId: null }
        : { [kind + 'Id']: targetId };
    const res = await moveFile({ assetId, ...(target as Record<string, string | string[] | null | undefined>) }).catch(() => null);
    setBusy(false);
    toast(res?.error ?? res?.message ?? 'Failed.', res?.ok ? 'ok' : 'err');
    if (res?.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  const options = kind === 'project' ? projects : kind === 'task' ? tasks : kind === 'lead' ? leads : [];

  return (
    <>
      <button className={compact ? 'btn sq' : 'btn'} disabled={busy} onClick={() => setOpen(true)} title={`Move ${assetName} to a project / task / lead`}>
        ⇄
      </button>
      {open ? (
        <div className="modalbg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="card modal" role="dialog" aria-modal="true" aria-label={`Move ${assetName}`}>
            <div className="panelhead">
              <h2>Move "{assetName}"</h2>
              <button className="btn sq" onClick={() => setOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <div className="sub" style={{ marginBottom: 10 }}>
              Where should this file live? One home at a time — moving it moves the single copy.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={`btn sq${kind === 'none' ? ' primary' : ''}`} onClick={() => pick('none')}>Library</button>
              <button className={`btn sq${kind === 'project' ? ' primary' : ''}`} onClick={() => pick('project')}>Project</button>
              <button className={`btn sq${kind === 'task' ? ' primary' : ''}`} onClick={() => pick('task')}>Task</button>
              <button className={`btn sq${kind === 'lead' ? ' primary' : ''}`} onClick={() => pick('lead')}>Lead</button>
            </div>
            {kind !== 'none' ? (
              <label className="field" style={{ marginTop: 12 }}>
                Choose {kind}
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">— choose {kind} —</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" disabled={busy || (kind !== 'none' && !targetId)} onClick={save}>
                {busy ? 'Moving…' : 'Move file'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
