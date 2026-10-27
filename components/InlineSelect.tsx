'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';

type Action = (raw: unknown) => Promise<{ ok: boolean; error?: string; message?: string }>;

export default function InlineSelect({
  value,
  field,
  options,
  action,
  id,
  className = 'fieldselect',
  alwaysNotify = false,
}: {
  value: string;
  field: string;
  options: { value: string; label: string }[];
  action: Action;
  id: string;
  className?: string;
  alwaysNotify?: boolean;
}) {
  const [current, setCurrent] = useState(value);
  const toast = useToast();
  const router = useRouter();

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation();
    const next = e.target.value;
    setCurrent(next); // optimistic
    const res = await action({ id, [field]: next });
    if (!res.ok) {
      setCurrent(value);
      toast(res.error ?? 'Failed.', 'err');
      return;
    }
    if (res.message || alwaysNotify) toast(res.message ?? 'Saved.');
    router.refresh();
  }

  return (
    <select className={className} value={current} onChange={onChange} aria-label={`Change ${field}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
