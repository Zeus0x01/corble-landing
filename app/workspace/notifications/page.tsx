import Link from 'next/link';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { formatDT } from '@/lib/format';
import MarkRead from './MarkRead';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await auth();
  const me = session?.user?.id as string;
  const sp = await searchParams;
  const unreadOnly = sp?.show === 'unread';

  const items = await db.notification.findMany({
    where: { userId: me, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 120,
  });
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Notifications</h2>
          <div className="sub">
            {unread > 0 ? `${unread} unread` : 'All caught up'} · last 120 shown
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn" href="/workspace/notifications?show=unread">Unread</Link>
          <Link className="btn" href="/workspace/notifications">All</Link>
          <MarkRead />
        </div>
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Type</th><th>Message</th><th>Detail</th><th>Link</th><th>At</th><th></th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="empty">No notifications{unreadOnly ? ' unread' : ''}.</td></tr>
            ) : (
              items.map((n) => (
                <tr key={n.id} style={n.readAt ? { opacity: 0.55 } : undefined}>
                  <td><span className="pill">{labelType(n.type)}</span></td>
                  <td><strong>{n.title}</strong></td>
                  <td><div className="itemsub">{n.body ?? '—'}</div></td>
                  <td>{n.link ? <Link href={n.link} style={{ color: 'var(--purple)' }}>Open →</Link> : '—'}</td>
                  <td>{formatDT(n.createdAt)}</td>
                  <td style={{ textAlign: 'center', width: 44 }}>{n.readAt ? '✓' : <MarkRead id={n.id} />}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function labelType(t: string): string {
  return t.replaceAll('_', ' ').toLowerCase();
}
