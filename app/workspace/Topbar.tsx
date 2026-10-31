'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

type Props = {
  pathname: string;
  user: { name: string; email: string; role: string };
  companyName: string;
  currency: string;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
};

const TITLES: Record<string, [string, string]> = {
  '/workspace': ['Overview', 'The whole operation, in one screen.'],
  '/workspace/leads': ['Leads / CRM (Final)', 'Every prospect and follow-up in one place.'],
  '/workspace/projects': ['Projects', 'Delivery, ownership, budget, milestones.'],
  '/workspace/tasks': ['My Tasks', 'Your personal work, by when.'],
  '/workspace/tasks/team': ['Team Tasks', 'Overdue, claimable, handover status.'],
  '/workspace/deliverables': ['Deliverables', 'Submissions, versions and review.'],
  '/workspace/automation': ['Automation', 'Workflow delivery in phases.'],
  '/workspace/github': ['Website Projects', 'Browse and edit connected GitHub repos.'],
  '/workspace/vercel': ['Deployments', 'Preview and production releases.'],
  '/workspace/finance': ['Finance', 'Invoices, payments, expenses.'],
  '/workspace/team': ['Team', 'People, roles, and open work.'],
  '/workspace/profile': ['Profile', 'The person behind the work.'],
  '/workspace/notifications': ['Notifications', 'Handover and review updates.'],
  '/workspace/calendar': ['Calendar', 'Due dates and follow-ups at a glance.'],
  '/workspace/files': ['Files', 'Documents attached to work, with storage.'],
  '/workspace/templates': ['Templates', 'Kick off new projects from a saved playbook.'],
  '/workspace/reports': ['Reports', 'Pipeline, delivery, and cash numbers.'],
  '/workspace/settings': ['Settings', 'Company, currency, timezone, appearance.'],
};

export default function Topbar({ pathname, user, companyName, currency, onToggleTheme, onToggleSidebar, sidebarCollapsed }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const [title, sub] = TITLES[pathname] ?? (pathname.startsWith('/workspace/profile')
    ? TITLES['/workspace/profile']
    : [(pathname.split('/').pop() ?? 'Workspace').replace(/-/g, ' '), '']);

  useEffect(() => {
    setSidebarOpen(false);
    setQ(new URLSearchParams(window.location.search).get('q') ?? '');
  }, [pathname]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('globalSearch')?.focus();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

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

  function toggleSidebar() {
    setSidebarOpen((v) => !v);
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
          {q ? <button type="button" className="search-clear" onClick={() => onSearch('')} aria-label="Clear search">×</button> : <kbd>⌘K</kbd>}
        </label>
        <Link href="/workspace/notifications" className="btn sq" aria-label="Notifications" title="Notifications">
          ◉
        </Link>
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
        <Link href="/workspace/profile/me" className="pill profilepill" title={`${user.email} — open profile`}>
          {user.role === 'ADMIN' ? '★' : '•'} {user.name}
        </Link>
        <button
          className="btn sq"
          onClick={async () => {
            await signOut({ redirect: false });
            window.location.assign('/login');
          }}
          aria-label="Sign out"
          title="Sign out"
        >
          ⏻
        </button>
        <button className="btn sq ws-burger" onClick={toggleSidebar} aria-label="Toggle menu" title="Menu">≡</button>
        <button className="btn sq sidebar-toggle" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'} title={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}>
          {sidebarCollapsed ? '»' : '«'}
        </button>
      </div>
    </div>
  );
}
