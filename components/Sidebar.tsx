'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

type Item = { href: string; icon: string; label: string; admin?: boolean };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: 'Workspace',
    items: [
      { href: '/workspace', icon: '◱', label: 'Overview' },
      { href: '/workspace/calendar', icon: '▦', label: 'Calendar' },
      { href: '/workspace/notifications', icon: '◉', label: 'Notifications' },
      { href: '/workspace/profile/me', icon: '☺', label: 'My Profile' },
    ],
  },
  {
    title: 'Delivery',
    items: [
      { href: '/workspace/projects', icon: '▥', label: 'Projects' },
      { href: '/workspace/tasks', icon: '☑', label: 'My Tasks' },
      { href: '/workspace/tasks/team', icon: '≡', label: 'Team Tasks' },
      { href: '/workspace/deliverables', icon: '▣', label: 'Deliverables' },
      { href: '/workspace/automation', icon: '⚙', label: 'Automation' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { href: '/workspace/leads', icon: '◆', label: 'Leads / CRM (Final)' },
      { href: '/workspace/finance', icon: '₪', label: 'Finance' },
    ],
  },
  {
    title: 'Websites & Deploy',
    items: [
      { href: '/workspace/github', icon: '⌥', label: 'Websites (GitHub)' },
      { href: '/workspace/vercel', icon: '▲', label: 'Deployments' },
      { href: '/workspace/n8n', icon: '⁂', label: 'n8n Workflows', admin: true },
    ],
  },
  {
    title: 'Library',
    items: [
      { href: '/workspace/files', icon: '▦', label: 'Files' },
      { href: '/workspace/templates', icon: '❋', label: 'Templates' },
      { href: '/workspace/reports', icon: '▮', label: 'Reports' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/workspace/team', icon: '⛇', label: 'Team', admin: true },
      { href: '/workspace/settings', icon: '⚙', label: 'Settings' },
    ],
  },
];

function matchesPath(path: string, href: string): boolean {
  if (href === '/workspace/profile/me') return path === href || path.startsWith('/workspace/profile');
  return path === href || (href !== '/workspace' && path.startsWith(href + '/'));
}

function isActive(pathname: string, item: Item, allItems: Item[]): boolean {
  if (!matchesPath(pathname, item.href)) return false;
  const best = allItems
    .filter((j) => matchesPath(pathname, j.href))
    .reduce((best, j) => (j.href.length > best.length ? j.href : best), '/workspace');
  return item.href === best;
}

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const isAdmin = role === 'ADMIN';
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(title: string) {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
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
      <nav className="nav" aria-label="Workspace sections" id="wsnav">
        {GROUPS.map((group) => {
          const visibleItems = group.items.filter((i) => !i.admin || isAdmin);
          if (visibleItems.length === 0) return null;
          const allItems = visibleItems;
          const hasActive = visibleItems.some((i) => isActive(pathname, i, allItems));
          return (
            <div key={group.title} className={`navgroup${collapsed[group.title] && !hasActive ? ' collapsed' : ''}`}>
              <button
                type="button"
                className="navgrouptoggle"
                onClick={() => toggle(group.title)}
                aria-expanded={collapsed[group.title] && !hasActive ? 'false' : 'true'}
              >
                <span className="navlabel2">{group.title}</span>
                <span className="chev" aria-hidden="true" />
              </button>
              <div className="navgroupitems">
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(pathname, item, allItems) ? 'active' : ''}
                  >
                    <span className="ico" aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
