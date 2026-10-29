import type { Currency } from '@prisma/client';

export function formatMoney(amount: number | null | undefined, currency: Currency = 'EGP'): string {
  const n = typeof amount === 'number' ? amount : 0;
  const formatted = new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n);
  return currency === 'USD' ? `$${formatted}` : `EGP ${formatted}`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDT(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function toISODate(d: Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function labelize(v: string): string {
  return v
    .split('_')
    .map((p) => (p ? p[0] + p.slice(1).toLowerCase() : p))
    .join(' ');
}

export function progressTone(progress: number): string {
  return progress >= 80 ? 'var(--green)' : progress >= 40 ? 'var(--purple)' : 'var(--orange)';
}
