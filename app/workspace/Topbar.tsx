'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

type Props = {
  pathname: string;
  user: { name: string; email: string; role: string };
  companyName: string;
  currency: string;
  onToggleTheme: () => void;
};

const TITLES: Record<string, [string, string]> = {
  '/workspace': ['Overview', 'The whole operation, in one screen.'],
  '/workspace/leads': ['Leads / CRM', 'Keep every prospect and follow-up in one place.'],
  '/workspace/projects': ['Projects', 'Track delivery, ownership, budget, and milestones.'],
  '/workspace/tasks': ['Tasks', 'Who does what, by when.'],
  '/workspace/finance': ['Finance', 'Invoices, payments, and expenses.'],
  '/workspace/team': ['Team', 'People, roles, and open work.'],
  '/workspace/calendar': ['Calendar', 'Due dates and follow-ups at a glance.'],
  '/workspace/files': ['Files', 'Documents attached to work, with storage.'],
  '/workspace/templates': ['Templates', 'Kick off new projects from a saved playbook.'],
  '/workspace/reports': ['Reports', 'Pipeline, delivery, and cash numbers.'],
  '/workspace/settings': ['Settings', 'Company, currency, timezone, appearance.'],
};

export default function Topbar({ pathname, user, companyName, currency, onToggleTheme }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const [title, sub] = TITLES[pathname] ?? ['Workspace', ''];

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar?.classList.toggle('open', sidebarOpen);
    backdrop?.classList.toggle('show', sidebarOpen);

    // Body scroll lock while drawer is open on mobile
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    const onBackdrop = () => setSidebarOpen(false);

    if (sidebarOpen) {
      window.addEventListener('keydown', onKey);
      backdrop?.addEventListener('click', onBackdrop);
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      backdrop?.removeEventListener('click', onBackdrop);
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  function onSearch(v: string) {
    setQ(v);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (v) params.set('q', v);
      else params.delete('q');
      router.replace(`${window.location.pathname}?${params}`);
    }, 350);
  }

  return (
    <div className="wstop" style={{ padding: '26px clamp(18px,3vw,42px) 0' }}>
      <div>
        <button
          className="mobilemenu"
          aria-expanded={sidebarOpen}
          aria-label="Toggle sidebar"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          ☰ Menu
        </button>
        <div className="eyebrow2" style={{ letterSpacing: '1.6px' }}>
          {companyName} · Workspace
        </div>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      <div className="wstop-right">
        <label className="ws-search" htmlFor="globalSearch">
          <span aria-hidden="true">⌕</span>
          <input
            id="globalSearch"
            type="search"
            placeholder="Search in this view…"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        <span className="pill" title={`Workspace currency: ${currency}`}>
          {currency}
        </span>
        <button
          className="btn sq"
          onClick={onToggleTheme}
          aria-label="Toggle light/dark theme"
          title="Toggle theme"
        >
          <span aria-hidden="true" id="themeIcon">
            ◐
          </span>
        </button>
        <span className="pill" title={user.email}>
          {user.role === 'ADMIN' ? '★' : '•'} {user.name}
        </span>
        <button
          className="btn sq"
          onClick={() => signOut({ callbackUrl: '/login' })}
          aria-label="Sign out"
          title="Sign out"
        >
          ⏻
        </button>
      </div>
    </div>
  );
}
