'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const ITEMS: { href: string; icon: string; label: string; admin?: boolean }[] = [
  { href: '/workspace', icon: '◱', label: 'Overview' },
  { href: '/workspace/leads', icon: '◆', label: 'Leads / CRM (Final)' },
  { href: '/workspace/leads/incoming', icon: '▤', label: 'Incoming Leads' },
  { href: '/workspace/projects', icon: '▥', label: 'Projects' },
  { href: '/workspace/tasks', icon: '☑', label: 'My Tasks' },
  { href: '/workspace/tasks/team', icon: '≡', label: 'Team Tasks' },
  { href: '/workspace/deliverables', icon: '▣', label: 'Deliverables' },
  { href: '/workspace/automation', icon: '⚙', label: 'Automation' },
  { href: '/workspace/github', icon: '⌥', label: 'Websites (GitHub)' },
  { href: '/workspace/vercel', icon: '▲', label: 'Deployments' },
  { href: '/workspace/finance', icon: '₪', label: 'Finance' },
  { href: '/workspace/team', icon: '⛇', label: 'Team', admin: true },
  { href: '/workspace/profile/me', icon: '☺', label: 'My Profile' },
  { href: '/workspace/notifications', icon: '◉', label: 'Notifications' },
  { href: '/workspace/calendar', icon: '▦', label: 'Calendar' },
  { href: '/workspace/files', icon: '▦', label: 'Files' },
  { href: '/workspace/templates', icon: '❋', label: 'Templates' },
  { href: '/workspace/reports', icon: '▮', label: 'Reports' },
  { href: '/workspace/settings', icon: '⚙', label: 'Settings' },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  function matchesPath(path: string, href: string): boolean {
    if (href === '/workspace/profile/me') return path === href || path.startsWith('/workspace/profile');
    return path === href || (href !== '/workspace' && path.startsWith(href + '/'));
  }

  return (
    <aside className="wssidebar" id="sidebar">
      <div className="wsbrand">
        <img src="/corble-logo-dark.png" alt="" width={574} height={192} />
        <span>{'Corble'}</span>
      </div>
      <div className="status" role="status">
        <span className="dot" aria-hidden="true" />
        <span style={{ fontSize: 12.5 }}>Workspace online</span>
      </div>
      <div className="navlabel">Workspace</div>
      <nav className="nav" aria-label="Workspace sections" id="wsnav">
        {ITEMS.filter((i) => !i.admin || role === 'ADMIN').map((i) => {
          const visible = ITEMS.filter((j) => !j.admin || role === 'ADMIN');
          const best = visible.reduce((best, j) => (matchesPath(pathname, j.href) && j.href.length >= best.length ? j.href : best), '/workspace');
          const active = matchesPath(pathname, i.href) && (i.href === best || (!matchesPath(pathname, '/workspace') && best === '/workspace'));
          return (
            <Link key={i.href} href={i.href} className={active ? 'active' : ''}>
              <span className="ico" aria-hidden="true">{i.icon}</span>
              {i.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebottom">
        <Link href="/" style={{ display: 'inline-block', marginTop: 8, color: 'var(--nav-active)' }}>← Back to site</Link>
      </div>
    </aside>
  );
}
