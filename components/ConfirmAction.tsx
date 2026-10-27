'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';

type Action = (raw: unknown) => Promise<{ ok: boolean; error?: string; message?: string }>;

export default function ConfirmAction({
  action,
  payload,
  label,
  confirmText = 'Delete this record?',
  className = 'btn sq danger',
  title,
  children,
}: {
  action: Action;
  payload: string;
  label: string;
  confirmText?: string;
  className?: string;
  title?: string;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      title={title ?? label}
      disabled={busy}
      aria-label={label}
      onClick={async () => {
        if (!window.confirm(confirmText)) return;
        setBusy(true);
        const res = await action(payload);
        setBusy(false);
        if (!res.ok) toast(res.error ?? 'Failed.', 'err');
        else toast(res.message ?? 'Deleted.');
        router.refresh();
      }}
    >
      {busy ? '…' : children ?? label}
    </button>
  );
}
