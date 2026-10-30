'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { decideHandover } from '@/lib/actions';

export default function HandoverButtons({
  requestId,
  requesterName,
  requesterId,
  canDecide,
}: {
  requestId: string;
  requesterName: string;
  requesterId: string;
  canDecide: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(decision: 'APPROVE' | 'REJECT') {
    setBusy(true);
    const res = await decideHandover({ requestId, decision });
    setBusy(false);
    toast(res.error ?? res.message ?? '', res.ok ? 'ok' : 'err');
    if (res.ok) router.refresh();
  }

  return (
    <span style={{ display: 'inline-flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
      <span className="pill">{requesterName} requests</span>
      {canDecide ? (
        <>
          <button className="btn sq" disabled={busy} onClick={() => act('APPROVE')} title={`Approve handover to ${requesterName}`} aria-label={`Approve ${requesterName}`}>✓</button>
          <button className="btn sq" disabled={busy} onClick={() => act('REJECT')} title={`Decline ${requesterName}`} aria-label={`Decline ${requesterName}`}>✕</button>
        </>
      ) : (
        <span className="itemsub">awaiting owner</span>
      )}
      <span style={{ display: 'none' }}>{requesterId}</span>
    </span>
  );
}
