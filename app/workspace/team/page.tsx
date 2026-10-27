import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { addTeamUser, deleteTeamUser, resetTeamPassword } from '@/lib/actions';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const [users, openByUser] = await Promise.all([
    db.user.findMany({
      where: query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'asc' },
    }),
    db.task.groupBy({ by: ['assigneeId'], _count: { _all: true }, where: { status: { not: 'DONE' } } }),
  ]);
  const openMap = new Map(openByUser.map((o) => [o.assigneeId, o._count._all]));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>People</h2>
          <div className="sub">Admins can add members, remove them, or reset passwords.</div>
        </div>
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

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Person</th><th>Role</th><th>Open tasks</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong><div className="itemsub">{u.email}</div></td>
                <td><span className={`pill ${u.role === 'ADMIN' ? 'won' : ''}`}>{u.role === 'ADMIN' ? '★ Admin' : 'Member'}</span></td>
                <td>{openMap.get(u.id) ?? 0}</td>
                <td>{formatDate(u.createdAt)}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <ModalForm
                    title={`Reset password — ${u.name}`}
                    trigger=" Reset PW"
                    triggerClass="btn sq"
                    action={resetTeamPassword}
                    hidden={{ userId: u.id }}
                    fields={[{ label: `New password for ${u.name}`, name: 'password', type: 'password', required: true, full: true, placeholder: 'min 8 characters' }]}
                  />
                  <ConfirmAction
                    action={deleteTeamUser}
                    payload={u.id}
                    label={`Remove ${u.name}`}
                    confirmText={`Remove ${u.name} (${u.email}) from the workspace?`}
                    className="btn sq danger"
                  >✕</ConfirmAction>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
