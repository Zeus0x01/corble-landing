import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { labelize, formatDate } from '@/lib/format';
import HandoverButtons from '../HandoverButtons';
import TaskActions from '../TaskActions';

export const dynamic = 'force-dynamic';

export default async function TeamTasksPage({ searchParams }: { searchParams: Promise<{ q?: string; reason?: string }> }) {
  const session = await auth();
  const meId = session?.user?.id as string;
  const role = (session?.user?.role ?? 'MEMBER') as string;
  if (role !== 'ADMIN') {
    return (
      <div className="empty">
        Team Tasks is available to administrators only. Use <a href="/workspace/tasks">My Tasks</a> for your assigned work.
      </div>
    );
  }
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const reason = sp.reason ?? 'all';
  const now = new Date();

  const tasks = await db.task.findMany({
    where: {
      deletedAt: null,
      title: query ? { contains: query, mode: 'insensitive' } : undefined,
    },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }],
    include: {
      project: { select: { name: true } },
      assignee: { select: { name: true } },
      originalOwner: { select: { name: true } },
      handovers: { where: { status: 'PENDING' }, select: { id: true, requesterId: true, ownerId: true, requester: { select: { name: true, id: true } } } },
    },
  });

  const myRequests = await db.handoverRequest.findMany({ where: { requesterId: meId, status: 'PENDING' }, select: { taskId: true } });
  const iRequested = new Set(myRequests.map((r) => r.taskId));

  type Row = {
    id: string;
    title: string;
    reason: 'OVERDUE' | 'CLAIMABLE' | 'HANDOVER' | 'TAKEN_OVER';
    assigneeId: string | null;
    originalOwnerId: string | null;
    status: string;
    priority: string;
    dueDate: Date | null;
    eligible: boolean;
    project: string;
    assigneeName: string;
    originalOwnerName: string | null;
    handovers: typeof tasks[number]['handovers'];
  };

  const rows: Row[] = [];
  for (const t of tasks) {
    if (t.status === 'DONE') continue;
    const overdue = Boolean(t.dueDate && t.dueDate < now);
    const claimed = t.eligibleForHandover && t.assigneeId !== null && t.assigneeId !== meId;
    const pending = t.handovers.length > 0;
    const moved = Boolean(t.originalOwnerId && t.assigneeId && t.originalOwnerId !== t.assigneeId);
    const why: Row['reason'] | null = pending ? 'HANDOVER' : moved ? 'TAKEN_OVER' : claimed && overdue ? 'CLAIMABLE' : overdue ? 'OVERDUE' : claimed ? 'CLAIMABLE' : null;
    if (!why) continue;
    if ((reason === 'overdue' && why !== 'OVERDUE' && why !== 'HANDOVER') || (reason === 'handover' && why !== 'HANDOVER' && why !== 'TAKEN_OVER') || (reason === 'claimable' && why !== 'CLAIMABLE')) continue;
    rows.push({
      id: t.id,
      title: t.title,
      reason: why,
      assigneeId: t.assigneeId,
      originalOwnerId: t.originalOwnerId,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      eligible: t.eligibleForHandover,
      project: t.project?.name ?? '—',
      assigneeName: t.assignee?.name ?? 'Unassigned',
      originalOwnerName: t.originalOwner?.name ?? null,
      handovers: t.handovers,
    });
  }

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Team tasks</h2>
          <div className="sub">Overdue, claimable and handover-in-progress work across the team. {rows.length} visible.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn" href="/workspace/tasks/team?reason=overdue">Overdue</a>
          <a className="btn" href="/workspace/tasks/team?reason=claimable">Claimable</a>
          <a className="btn" href="/workspace/tasks/team?reason=handover">Handover</a>
          <a className="btn" href="/workspace/tasks/team">All</a>
        </div>
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Task</th><th>Reason</th><th>Owner</th><th>Current assignee</th><th>Status</th><th>Due</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="empty">Nothing pending across the team in this filter.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.title}</strong>
                    <div className="itemsub">{row.project}</div>
                  </td>
                  <td>
                    <span className="pill" style={row.reason === 'HANDOVER' ? { color: 'var(--acid)' } : undefined}>{labelize(row.reason)}</span>
                    {row.eligible ? <span className="pill">assistance offered</span> : null}
                  </td>
                  <td>{row.originalOwnerName ?? '—'}</td>
                  <td>
                    <div>{row.assigneeName}</div>
                    <div className="itemsub">{row.originalOwnerName && row.originalOwnerName !== row.assigneeName ? `took over from ${row.originalOwnerName}` : 'original owner'}</div>
                  </td>
                  <td>{labelize(row.status)} · {labelize(row.priority)}</td>
                  <td style={{ color: row.reason === 'OVERDUE' || row.reason === 'CLAIMABLE' ? 'var(--acid)' : undefined }}>{formatDate(row.dueDate)}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 330 }}>
                    {row.handovers.map((h) => (
                      <HandoverButtons
                        key={h.id}
                        requestId={h.id}
                        requesterName={h.requester.name}
                        requesterId={h.requesterId}
                        canDecide={h.ownerId === meId || row.originalOwnerId === meId || role === 'ADMIN'}
                      />
                    ))}
                    <TaskActions
                      taskId={row.id}
                      title={row.title}
                      meId={meId}
                      isAdmin={role === 'ADMIN'}
                      assigneeId={row.assigneeId}
                      ownerId={row.originalOwnerId}
                      status={row.status}
                      eligible={row.eligible}
                      pendingForMe={row.assigneeId === meId && row.handovers.length > 0}
                      iRequested={iRequested.has(row.id)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="sub" style={{ padding: '8px 2px' }}>
        Claimability is explicit: only tasks offered for assistance appear as claimable — past due dates alone never make a task claimable.
      </div>
    </>
  );
}
