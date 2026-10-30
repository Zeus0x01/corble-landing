import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import {
  removeTeamUserAndExit,
  resetTeamPassword,
  toggleTeamUserActive,
  updateTeamUser,
} from '@/lib/actions';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';

export const dynamic = 'force-dynamic';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect('/login');
  const viewerId = session.user.id;
  const isSelf = id === 'me' || id === viewerId;
  const isAdmin = session.user.role === 'ADMIN';

  // Members can only open their own profile; admins can open anyone's.
  if (!isSelf && !isAdmin) redirect('/workspace');

  const targetId = isSelf ? viewerId : id;

  const user = await db.user.findUnique({ where: { id: targetId } });
  if (!user) notFound();

  const now = new Date();
  const [
    openTasks,
    doneTasks,
    overdueTasks,
    projectCount,
    leadCount,
    fileCount,
    activityCount,
    recentTasks,
    recentFiles,
    recentActivity,
  ] = await Promise.all([
    db.task.count({ where: { assigneeId: user.id, status: { not: 'DONE' }, deletedAt: null } }),
    db.task.count({ where: { assigneeId: user.id, status: 'DONE', deletedAt: null } }),
    db.task.count({ where: { assigneeId: user.id, status: { not: 'DONE' }, dueDate: { lt: now }, deletedAt: null } }),
    db.project.count({ where: { ownerId: user.id } }),
    db.lead.count({ where: { ownerId: user.id } }),
    db.fileAsset.count({ where: { uploadedById: user.id } }),
    db.activity.count({ where: { userId: user.id } }),
    db.task.findMany({
      where: { assigneeId: user.id, deletedAt: null },
      include: { project: { select: { name: true } } },
      orderBy: [{ status: 'desc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
      take: 6,
    }),
    db.fileAsset.findMany({
      where: { uploadedById: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.activity.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>{isSelf ? 'My profile' : 'Member profile'}</h2>
          <div className="sub">{isSelf ? 'Your account, work, and recent activity.' : 'Everything about this person.'}</div>
        </div>
        <Link href="/workspace/team" className="btn">← Back to team</Link>
      </div>

      <div className="card profilehead">
        <div className={`avatar ${user.role === 'ADMIN' ? 'gold' : ''}`} aria-hidden="true">
          {initials(user.name)}
        </div>
        <div className="profilemeta">
          <div className="profilename">
            <strong>{user.name}</strong>
            <span className={`pill ${user.role === 'ADMIN' ? 'contacted' : ''}`}>
              {user.role === 'ADMIN' ? '★ Admin' : 'Member'}
            </span>
            <span className={`pill ${user.isActive ? 'won' : 'lost'}`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="itemsub">{user.email}</div>
          <div className="itemsub">
            Joined {formatDate(user.createdAt)} · Last updated {formatDate(user.updatedAt)}
          </div>
        </div>
        {isAdmin && (
          <div className="profileactions">
            <ModalForm
              title={`Edit profile — ${user.name}`}
              trigger="Edit details"
              action={updateTeamUser}
              hidden={{ id: user.id }}
              fields={[
                { label: 'Full name', name: 'name', required: true, value: user.name },
                { label: 'Email', name: 'email', type: 'email', required: true, value: user.email },
                {
                  label: 'Role',
                  name: 'role',
                  type: 'select',
                  required: true,
                  value: user.role,
                  options: [{ value: 'MEMBER', label: 'Member' }, { value: 'ADMIN', label: 'Admin' }],
                },
              ]}
            />
            <ModalForm
              title={`Reset password — ${user.name}`}
              trigger=" Reset PW"
              triggerClass="btn sq"
              action={resetTeamPassword}
              hidden={{ userId: user.id }}
              fields={[{ label: `New password for ${user.name}`, name: 'password', type: 'password', required: true, full: true, placeholder: 'min 8 characters' }]}
            />
            {!isSelf && (
              <>
                <ConfirmAction
                  action={toggleTeamUserActive}
                  payload={user.id}
                  label={user.isActive ? `Deactivate ${user.name}` : `Reactivate ${user.name}`}
                  confirmText={user.isActive
                    ? `Deactivate ${user.name} (${user.email})? They will no longer be able to sign in.`
                    : `Reactivate ${user.name} (${user.email})?`}
                  className="btn sq"
                >
                  {user.isActive ? '✓' : '⏵'}
                </ConfirmAction>
                <ConfirmAction
                  action={removeTeamUserAndExit}
                  payload={user.id}
                  label={`Remove ${user.name}`}
                  confirmText={`Remove ${user.name} (${user.email}) from the workspace? This cannot be undone.`}
                  className="btn sq danger"
                >✕</ConfirmAction>
              </>
            )}
          </div>
        )}
      </div>

      <div className="kpis profilekpis">
        <div className="kpi">
          <div className="klabel">Open tasks</div>
          <div className="num">{openTasks}{overdueTasks > 0 ? ` · ${overdueTasks} overdue` : ''}</div>
        </div>
        <div className="kpi">
          <div className="klabel">Tasks done</div>
          <div className="num">{doneTasks}</div>
        </div>
        <div className="kpi">
          <div className="klabel">Projects owned</div>
          <div className="num">{projectCount}</div>
        </div>
        <div className="kpi">
          <div className="klabel">Leads owned</div>
          <div className="num">{leadCount}</div>
        </div>
        <div className="kpi">
          <div className="klabel">Files uploaded</div>
          <div className="num">{fileCount}</div>
        </div>
      </div>

      <div className="profilegrid">
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, letterSpacing: '.02em' }}>Recent tasks</h3>
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr><th>Task</th><th>Status</th><th>Priority</th><th>Due</th></tr>
              </thead>
              <tbody>
                {recentTasks.length === 0 && (
                  <tr><td className="empty" colSpan={4}>No tasks assigned yet.</td></tr>
                )}
                {recentTasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.title}</strong>
                      {t.project && <div className="itemsub">{t.project.name}</div>}
                    </td>
                    <td><span className={`pill ${t.status.toLowerCase()}`}>{t.status.replace('_', ' ').toLowerCase()}</span></td>
                    <td><span className={`pill ${t.priority.toLowerCase()}`}>{t.priority.toLowerCase()}</span></td>
                    <td>{formatDate(t.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ margin: '24px 0 10px', fontSize: 14, letterSpacing: '.02em' }}>Recent files</h3>
          <div className="tablewrap">
            <table className="table">
              <tbody>
                {recentFiles.length === 0 && (
                  <tr><td className="empty" colSpan={2}>No files uploaded yet.</td></tr>
                )}
                {recentFiles.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.name}</strong>
                      <div className="itemsub">{(f.size / 1024).toFixed(0)} KB</div>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>{formatDate(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 12px', fontSize: 14, letterSpacing: '.02em' }}>
            Activity log <span className="pill" style={{ marginLeft: 6 }}>{activityCount}</span>
          </h3>
          {recentActivity.length === 0 && <div className="empty">No activity recorded yet.</div>}
          <ul className="activitylist">
            {recentActivity.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.message}</strong>
                  {a.detail && <div className="itemsub">{a.detail}</div>}
                </div>
                <span className="itemsub" style={{ whiteSpace: 'nowrap' }}>{formatDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
