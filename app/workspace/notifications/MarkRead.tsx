'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { markNotificationsRead } from '@/lib/actions';

export default function MarkRead({ id }: { id?: string }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return id ? (
    <button
      className="btn sq"
      disabled={busy}
      title="Mark as read"
      aria-label={`Mark notification ${id} read`}
      onClick={async () => {
        setBusy(true);
        const res = await markNotificationsRead({ id });
        setBusy(false);
        toast(res.error ?? res.message ?? '', res.ok ? 'ok' : 'err');
        if (res.ok) router.refresh();
      }}
    >
      ✓
    </button>
  ) : (
    <button
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await markNotificationsRead({ all: true });
        setBusy(false);
        toast(res.error ?? res.message ?? '', res.ok ? 'ok' : 'err');
        if (res.ok) router.refresh();
      }}
    >
      Mark all read
    </button>
  );
}
