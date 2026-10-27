'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { saveSettings, saveMyTheme } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';

export default function SettingsForm({
  current,
  isAdmin,
}: {
  current: { companyName: string; currency: 'EGP' | 'USD'; timezone: string; theme: 'dark' | 'light' };
  isAdmin: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState(current.companyName);
  const [currency, setCurrency] = useState(current.currency);
  const [timezone, setTimezone] = useState(current.timezone);
  const [theme, setTheme] = useState(current.theme);

  async function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    const res = await saveMyTheme(next);
    if (!res.ok) toast(res.error ?? 'Could not save theme.', 'err');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = (await saveSettings({ companyName, currency, timezone, theme })) as ActionResult;
    setBusy(false);
    if (!res.ok) toast(res.error ?? 'Failed.', 'err');
    else {
      toast('Settings saved.');
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="formgrid" style={{ marginBottom: 20 }}>
      <label className="field">Company name
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required disabled={!isAdmin} />
      </label>
      <label className="field">Currency
        <select value={currency} onChange={(e) => setCurrency(e.target.value as 'EGP' | 'USD')} disabled={!isAdmin}>
          <option value="EGP">EGP</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label className="field">Timezone
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!isAdmin}>
          {['Africa/Cairo', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Riyadh', 'America/New_York', 'UTC'].map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </label>
      <div className="field">Appearance (per user)
        <button type="button" className="btn" onClick={toggleTheme}>Current: {theme === 'light' ? 'Light' : 'Dark'} — toggle</button>
      </div>
      {isAdmin && (
        <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
        </div>
      )}
    </form>
  );
}
