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
};

const TITLES: Record<string, [string, string]> = {
  '/workspace': ['Overview', 'The whole operation, in one screen.'],
  '/workspace/leads': ['Leads / CRM (Final)', 'Every prospect and follow-up in one place.'],
  '/workspace/leads/incoming': ['Incoming Leads', 'Scraped business data: research, verify, approve.'],
  '/workspace/projects': ['Projects', 'Delivery, ownership, budget, milestones.'],
  '/workspace/tasks': ['My Tasks', 'Your personal work, by when.'],
  '/workspace/tasks/team': ['Team Tasks', 'Overdue, claimable, handover status.'],
  '/workspace/deliverables': ['Deliverables', 'Submissions, versions and review.'],
  '/workspace/automation': ['Automation', 'Workflow delivery in phases.'],
  '/workspace/github': ['Website Projects', 'Browse and edit connected GitHub repos.'],
  '/workspace/vercel': ['Deployments', 'Preview and production releases.'],
  '/workspace/finance': ['Finance', 'Invoices, payments, expenses.'],
  '/workspace/team': ['Team', 'People, roles, and open work.'],
  '/workspace/notifications': ['Notifications', 'Handover and review updates.'],
  '/workspace/calendar': ['Calendar', 'Due dates and follow-ups.'],
  '/workspace/files': ['Files', 'Documents attached to work.'],
  '/workspace/templates': ['Templates', 'Automation and website playbook.'],
  '/workspace/reports': ['Reports', 'Pipeline, delivery, cash numbers.'],
  '/workspace/settings': ['Settings', 'Company, currency, timezone, appearance.'],
};

export default function Topbar({ pathname, user, companyName, currency, onToggleTheme }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const [title, sub] = TITLES[pathname] ?? [pathname.split('/').pop()?.replace(/-/g, ' ') || 'Workspace', ''];

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar?.classList.toggle('open', sidebarOpen);
    backdrop?.classList.toggle('show', sidebarOpen);
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
      <div className="wstop-head">
        <div>
          <div className="eyebrow2" style={{ letterSpacing: '1.6px' }}>{companyName} · Workspace</div>
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
          <Link href="/workspace/notifications" className="btn sq" aria-label="Notifications" title="Notifications">
            ◉
          </Link>
          <span className="pill" title={`Workspace currency: ${currency}`}>{currency}</span>
          <button className="btn sq" onClick={onToggleTheme} aria-label="Toggle light/dark theme" title="Toggle theme">
            <span aria-hidden="true" id="themeIcon">◐</span>
          </button>
          <span className="pill" title={user.email}>{user.role === 'ADMIN' ? '★' : '•'} {user.name}</span>
          <button className="btn sq" onClick={() => signOut({ callbackUrl: '/login' })} aria-label="Sign out" title="Sign out">⏻</button>
          <button className="btn sq ws-burger" onClick={toggleSidebar} aria-label="Toggle menu" title="Menu">≡</button>
        </div>
      </div>
    </div>
  );
}
