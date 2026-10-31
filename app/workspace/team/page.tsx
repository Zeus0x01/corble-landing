import Link from 'next/link';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { addTeamUser, resetTeamPassword, toggleTeamUserActive, updateTeamUser } from '@/lib/actions';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const [users, openByUser, totalUsers, activeUsers, adminUsers] = await Promise.all([
    db.user.findMany({
      where: query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'asc' },
    }),
    db.task.groupBy({ by: ['assigneeId'], _count: { _all: true }, where: { status: { not: 'DONE' }, deletedAt: null } }),
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.user.count({ where: { role: 'ADMIN', isActive: true } }),
  ]);
  const openMap = new Map(openByUser.map((o) => [o.assigneeId, o._count._all]));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>People</h2>
          <div className="sub">Manage access, roles, passwords, and workload without deleting team history.</div>
        </div>
        <div className="team-head-actions">
          <form className="ws-search" method="get" role="search">
            <span aria-hidden="true">⌕</span>
            <input name="q" defaultValue={query} placeholder="Search people…" aria-label="Search team members" />
          </form>
          <ModalForm
            title="Add team member"
            trigger="＋ Add member"
            action={addTeamUser}
            fields={[
              { label: 'Full name', name: 'name', required: true },
              { label: 'Email', name: 'email', type: 'email', required: true },
              { label: 'Role', name: 'role', type: 'select', options: [{ value: 'MEMBER', label: 'Member' }, { value: 'ADMIN', label: 'Admin' }], required: true },
              { label: 'Temp password (min 8 chars)', name: 'password', type: 'password', required: true, full: true, placeholder: 'min 8 characters' },
            ]}
          />
        </div>
      </div>

      <div className="kpis team-kpis">
        <div className="kpi"><div className="klabel">Total people</div><div className="num">{totalUsers}</div></div>
        <div className="kpi"><div className="klabel">Active</div><div className="num">{activeUsers}</div></div>
        <div className="kpi"><div className="klabel">Inactive</div><div className="num">{totalUsers - activeUsers}</div></div>
        <div className="kpi"><div className="klabel">Admins</div><div className="num">{adminUsers}</div></div>
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Person</th><th>Role</th><th>Status</th><th>Open tasks</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={6}><div className="empty">No team members match “{query}”.</div></td></tr>
            ) : users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/workspace/profile/${u.id}`} className="profilelink">
                    <strong>{u.name}</strong>
                    <div className="itemsub">{u.email}</div>
                  </Link>
                </td>
                <td><span className={`pill ${u.role === 'ADMIN' ? 'won' : ''}`}>{u.role === 'ADMIN' ? '★ Admin' : 'Member'}</span></td>
                <td><span className={`pill ${u.isActive ? 'won' : 'lost'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>{u.isActive ? (openMap.get(u.id) ?? 0) : '—'}</td>
                <td>{formatDate(u.createdAt)}</td>
                <td className="team-actions">
                  <Link
                    href={`/workspace/profile/${u.id}`}
                    className="btn sq"
                    aria-label={`Open profile of ${u.name}`}
                    title="View profile"
                  >☺</Link>
                  <ModalForm
                    title={`Edit profile — ${u.name}`}
                    trigger="Edit"
                    triggerClass="btn sq"
                    action={updateTeamUser}
                    hidden={{ id: u.id }}
                    fields={[
                      { label: 'Full name', name: 'name', required: true, value: u.name },
                      { label: 'Email', name: 'email', type: 'email', required: true, value: u.email },
                      { label: 'Role', name: 'role', type: 'select', required: true, value: u.role, options: [{ value: 'MEMBER', label: 'Member' }, { value: 'ADMIN', label: 'Admin' }] },
                    ]}
                  />
                  {u.isActive ? <ModalForm
                    title={`Reset password — ${u.name}`}
                    trigger="Reset PW"
                    triggerClass="btn sq"
                    action={resetTeamPassword}
                    hidden={{ userId: u.id }}
                    fields={[{ label: `New password for ${u.name}`, name: 'password', type: 'password', required: true, full: true, placeholder: 'min 8 characters' }]}
                  /> : null}
                  <ConfirmAction
                    action={toggleTeamUserActive}
                    payload={u.id}
                    label={u.isActive ? `Deactivate ${u.name}` : `Reactivate ${u.name}`}
                    confirmText={u.isActive
                      ? `Deactivate ${u.name} (${u.email})? They will no longer be able to sign in.`
                      : `Reactivate ${u.name} (${u.email})?`}
                    className={`btn sq${u.isActive ? ' danger' : ''}`}
                  >{u.isActive ? 'Deactivate' : 'Reactivate'}</ConfirmAction>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
