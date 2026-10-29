'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { submitPhase } from '@/lib/actions';

export default function PhaseActions({ phaseId, blocked }: { phaseId: string; blocked: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');

  if (blocked) return <span className="itemsub">waiting on prerequisite approval</span>;

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {!open ? (
        <button className="btn sq" disabled={busy} onClick={() => setOpen(true)} title="Submit phase for review" aria-label="Submit phase for review">⤒</button>
      ) : (
        <>
          <input className="textinput" style={{ minWidth: 220 }} autoFocus placeholder="What was built? (submission notes)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button
            className="btn"
            disabled={busy || !notes.trim()}
            onClick={async () => {
              setBusy(true);
              const res = await submitPhase({ phaseId, notes });
              setBusy(false);
              if (res.ok) {
                setOpen(false);
                setNotes('');
                toast(res.message ?? 'Submitted for review.', 'ok');
                router.refresh();
              } else {
                toast(res.error ?? 'Failed', 'err');
              }
            }}
          >
            Submit
          </button>
          <button className="btn sq" disabled={busy} onClick={() => setOpen(false)} title="Cancel" aria-label="Cancel submission">✕</button>
        </>
      )}
    </span>
  );
}
