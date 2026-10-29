'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { reviewDeliverable } from '@/lib/actions';

export default function ReviewForm({ versionId, status }: { versionId: string; status: string }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (!versionId || status === 'APPROVED') return <span className="itemsub">{status === 'APPROVED' ? 'approved' : '—'}</span>;

  async function act(decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED') {
    setBusy(true);
    const fallback = decision === 'APPROVED' ? 'Approved' : decision === 'REJECTED' ? 'Rejected' : 'Needs changes';
    const res = await reviewDeliverable({ versionId, decision, comment: comment.trim() || fallback });
    setBusy(false);
    toast(res.error ?? res.message ?? '', res.ok ? 'ok' : 'err');
    if (res.ok) {
      setOpen(false);
      setComment('');
      router.refresh();
    }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {!open ? (
        <>
          <button className="btn sq" disabled={busy} onClick={() => act('APPROVED')} title="Approve deliverable" aria-label="Approve deliverable">✓</button>
          <button className="btn sq" disabled={busy} onClick={() => act('CHANGES_REQUESTED')} title="Request changes (empty → 'Needs changes')" aria-label="Request changes on deliverable">✎</button>
          <button className="btn sq" disabled={busy} onClick={() => act('REJECTED')} title="Reject deliverable" aria-label="Reject deliverable">✕</button>
        </>
      ) : (
        <>
          <input className="textinput" style={{ minWidth: 200 }} autoFocus placeholder="Review comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn sq" disabled={busy} onClick={() => act('CHANGES_REQUESTED')} title="Send change request" aria-label="Send change request">➤</button>
          <button className="btn sq" disabled={busy} onClick={() => setOpen(false)} title="Cancel" aria-label="Cancel review">✕</button>
        </>
      )}
    </span>
  );
}
