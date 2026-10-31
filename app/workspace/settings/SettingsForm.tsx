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
  const [saved, setSaved] = useState(true);

  const changed = companyName !== current.companyName || currency !== current.currency || timezone !== current.timezone;

  async function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    const res = await saveMyTheme(next);
    if (!res.ok) toast(res.error ?? 'Could not save theme.', 'err');
    else toast(`Switched to ${next === 'light' ? 'light' : 'dark'} mode.`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = (await saveSettings({ companyName, currency, timezone, theme })) as ActionResult;
    setBusy(false);
    if (!res.ok) toast(res.error ?? 'Failed.', 'err');
    else {
      toast('Settings saved.');
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="settings-form">
      <div className="settings-section">
        <div>
          <div className="settings-section-title">Company defaults</div>
          <div className="settings-section-copy">These values are shared across the workspace and affect new records and reports.</div>
        </div>
        <div className="formgrid">
          <label className="field">Company name
            <input value={companyName} onChange={(e) => { setCompanyName(e.target.value); setSaved(false); }} required disabled={!isAdmin} />
          </label>
          <label className="field">Currency
            <select value={currency} onChange={(e) => { setCurrency(e.target.value as 'EGP' | 'USD'); setSaved(false); }} disabled={!isAdmin}>
              <option value="EGP">EGP — Egyptian pound</option>
              <option value="USD">USD — US dollar</option>
            </select>
          </label>
          <label className="field full">Workspace timezone
            <select value={timezone} onChange={(e) => { setTimezone(e.target.value); setSaved(false); }} disabled={!isAdmin}>
              {[
                ['Africa/Cairo', 'Africa/Cairo — Cairo'],
                ['Europe/London', 'Europe/London — London'],
                ['Europe/Berlin', 'Europe/Berlin — Berlin'],
                ['Asia/Dubai', 'Asia/Dubai — Dubai'],
                ['Asia/Riyadh', 'Asia/Riyadh — Riyadh'],
                ['America/New_York', 'America/New_York — New York'],
                ['UTC', 'UTC — Coordinated Universal Time'],
              ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <span className="fieldhint">Used when displaying dates, follow-ups, deadlines, and activity timestamps.</span>
          </label>
        </div>
      </div>
      <div className="settings-section settings-appearance">
        <div>
          <div className="settings-section-title">Your appearance</div>
          <div className="settings-section-copy">Only your personal theme changes. It does not affect other team members.</div>
        </div>
        <div className="appearance-control">
          <span className={`theme-preview ${theme}`}>{theme === 'light' ? '☀ Light' : '◐ Dark'}</span>
          <button type="button" className="btn" onClick={toggleTheme}>Switch to {theme === 'light' ? 'dark' : 'light'} mode</button>
        </div>
      </div>
      {isAdmin && (
        <div className="settings-footer">
          <span className="itemsub">{changed || !saved ? 'Unsaved changes' : 'All settings saved'}</span>
          <button className="btn primary" type="submit" disabled={busy || !changed}>{busy ? 'Saving…' : 'Save company settings'}</button>
        </div>
      )}
    </form>
  );
}
