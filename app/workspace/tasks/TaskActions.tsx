'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { requestHandover, completeTask, toggleTaskEligibility, addTaskComment } from '@/lib/actions';

type Props = {
  taskId: string;
  title: string;
  meId: string;
  isAdmin: boolean;
  assigneeId: string | null;
  ownerId: string | null;
  status: string;
  eligible: boolean;
  pendingForMe: boolean;
  iRequested: boolean;
  compact?: boolean;
};

export default function TaskActions(p: Props) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    return async () => {
      setBusy(true);
      const res = await fn();
      setBusy(false);
      toast(res.error ?? res.message ?? (res.ok ? 'Done.' : 'Failed'), res.ok ? 'ok' : 'err');
      if (res.ok) router.refresh();
    };
  }

  const mine = p.assigneeId === p.meId;

  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {!mine && p.assigneeId && p.status !== 'DONE' && (p.eligible || p.isAdmin) && !p.iRequested && !p.pendingForMe ? (
        showNote ? (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <input
              className="textinput"
              style={{ maxWidth: 220 }}
              placeholder="Note to the owner (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowNote(false);
                  void (async () => {
                    setBusy(true);
                    const res = await requestHandover({ taskId: p.taskId, note: note.trim() || undefined });
                    setBusy(false);
                    toast(res.error ?? res.message ?? 'Failed', res.ok ? 'ok' : 'err');
                    if (res.ok) {
                      setNote('');
                      router.refresh();
                    }
                  })();
                }
              }}
              autoFocus
            />
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await requestHandover({ taskId: p.taskId, note: note.trim() || undefined });
                setBusy(false);
                toast(res.error ?? res.message ?? 'Failed', res.ok ? 'ok' : 'err');
                if (res.ok) {
                  setNote('');
                  setShowNote(false);
                  router.refresh();
                }
              }}
              title="Send the handover request"
            >
              Send request
            </button>
            <button className="btn sq" disabled={busy} onClick={() => setShowNote(false)} aria-label="Cancel note">✕</button>
          </span>
        ) : (
          <button
            className="btn"
            disabled={busy}
            onClick={() => setShowNote(true)}
            title="Request to take over this task"
          >
            ⇄ Request handover
          </button>
        )
      ) : null}

      {p.iRequested && !p.pendingForMe ? <span className="pill">handover pending…</span> : null}
      {p.pendingForMe ? <span className="pill" style={{ color: 'var(--acid)' }}>⇄ pending your decision</span> : null}

      {mine ? (
        <>
          {p.status !== 'DONE' ? (
            <button className="btn sq" disabled={busy} onClick={run(() => completeTask({ taskId: p.taskId }))} title="Complete task" aria-label="Complete task">✓</button>
          ) : null}
          {p.status !== 'DONE' ? (
            <button className="btn sq" disabled={busy} onClick={run(() => toggleTaskEligibility({ taskId: p.taskId, eligible: !p.eligible }))} title={p.eligible ? 'Withdraw from Team Tasks' : 'Offer for assistance / possible handover'} aria-label="Toggle handover eligibility">
              {p.eligible ? '⤴' : '⤵'}
            </button>
          ) : null}
          <button className="btn sq" disabled={busy} onClick={() => setShowComment((v) => !v)} title="Add comment" aria-label="Add comment">💬</button>
        </>
      ) : null}

      {showComment ? (
        <span style={{ display: 'inline-flex', gap: 6, width: '100%' }}>
          <input
            className="textinput"
            placeholder="Comment…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && comment.trim()) {
                setShowComment(false);
                const res = await addTaskComment({ taskId: p.taskId, body: comment });
                setComment('');
                toast(res.error ?? res.message ?? '', res.ok ? 'ok' : 'err');
                if (res.ok) router.refresh();
              }
            }}
            autoFocus
          />
        </span>
      ) : null}
    </span>
  );
}
