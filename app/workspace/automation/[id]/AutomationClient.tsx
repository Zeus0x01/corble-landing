'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { reviewPhase, acceptDelivery } from '@/lib/actions';

export function AcceptDelivery({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        const res = await acceptDelivery({ projectId });
        setBusy(false);
        toast(res.error ?? res.message ?? '', res.ok ? 'ok' : 'err');
        if (res.ok) router.refresh();
      }}
    >
      ✓ Accept delivery
    </button>
  );
}

export function ReviewButtons({ submissionId, phaseTitle }: { submissionId: string; phaseTitle: string }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(decision: 'APPROVED' | 'CHANGES_REQUESTED') {
    setBusy(true);
    const res = await reviewPhase({ submissionId, decision, comment: decision === 'APPROVED' ? undefined : 'Please address the feedback.' });
    setBusy(false);
    toast(res.error ?? res.message ?? `Review recorded for ${phaseTitle}.`, res.ok ? 'ok' : 'err');
    if (res.ok) router.refresh();
  }
  return (
    <>
      <button className="btn sq" disabled={busy} onClick={() => act('APPROVED')} title="Approve phase" aria-label={`Approve ${phaseTitle}`}>✓</button>
      <button className="btn sq" disabled={busy} onClick={() => act('CHANGES_REQUESTED')} title="Request changes" aria-label={`Request changes on ${phaseTitle}`}>✎</button>
    </>
  );
}
