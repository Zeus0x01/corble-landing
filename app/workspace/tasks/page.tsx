import Link from 'next/link';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { labelize, formatDate } from '@/lib/format';
import { createTask, deleteTask, updateTask, updateTaskInline, decideHandover } from '@/lib/actions';
import InlineSelect from '@/components/InlineSelect';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';
import TaskActions from './TaskActions';
import HandoverButtons from './HandoverButtons';
import type { FieldSpec } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const STATUS = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const;
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH'] as const;

function taskFields(
  projects: { id: string; name: string }[],
  users: { id: string; name: string }[],
  edit?: { id: string; title: string; description: string | null; projectId: string | null; assigneeId: string | null; priority: string; status: string; startDate: Date | null; dueDate: Date | null },
): FieldSpec[] {
  return [
    { label: 'Task title', name: 'title', required: true, value: edit?.title },
    {
      label: 'Description',
      name: 'description',
      type: 'text',
      full: true,
      value: edit?.description ?? '',
    },
    { label: 'Project', name: 'projectId', type: 'select', options: [{ value: '', label: 'None' }, ...projects.map((p) => ({ value: p.id, label: p.name }))], value: edit?.projectId ?? '' },
    { label: 'Assignee', name: 'assigneeId', type: 'select', options: [{ value: '', label: 'Unassigned' }, ...users.map((u) => ({ value: u.id, label: u.name }))], value: edit?.assigneeId ?? '' },
    { label: 'Priority', name: 'priority', type: 'select', options: PRIORITY.map((p) => ({ value: p, label: labelize(p) })), value: edit?.priority },
    { label: 'Status', name: 'status', type: 'select', options: STATUS.map((s) => ({ value: s, label: labelize(s) })), value: edit?.status },
    { label: 'Start date', name: 'startDate', type: 'date', value: edit?.startDate ? edit.startDate.toISOString().slice(0, 10) : '' },
    { label: 'Due date', name: 'dueDate', type: 'date', value: edit?.dueDate ? edit.dueDate.toISOString().slice(0, 10) : '' },
    { label: 'Record ID', name: 'id', type: 'text', required: true, full: true, value: edit?.id ?? 'auto' },
  ];
}

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const session = await auth();
  const meId = session?.user?.id as string;
  const role = (session?.user?.role ?? 'MEMBER') as string;
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const statusFilter = STATUS.includes(sp.status as never) ? (sp.status as (typeof STATUS)[number]) : null;

  const tasks = await db.task.findMany({
    where: {
      AND: [
        role === 'ADMIN' ? {} : { OR: [{ assigneeId: meId }, { createdById: meId }] },
        query ? { title: { contains: query, mode: 'insensitive' } } : {},
        statusFilter ? { status: statusFilter } : {},
      ],
    },
    orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
    include: {
      project: { select: { name: true } },
      assignee: { select: { name: true } },
      originalOwner: { select: { name: true } },
      createdBy: { select: { name: true } },
      comments: { select: { id: true } },
      handovers: {
        where: { status: 'PENDING' },
        select: { id: true, requesterId: true, requester: { select: { name: true, id: true } } },
      },
      _count: { select: { comments: true, deliverables: true } },
    },
  });
  const [projects, users, myRequests] = await Promise.all([
    db.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.handoverRequest.findMany({ where: { requesterId: meId, status: 'PENDING' }, select: { taskId: true } }),
  ]);
  const iRequested = new Set(myRequests.map((r) => r.taskId));

  const overdue = tasks.filter((t) => t.status !== 'DONE' && t.dueDate && t.dueDate < new Date()).length;

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>My tasks</h2>
          <div className="sub">
            {tasks.length} tasks · {overdue} overdue · pending handover decisions: {tasks.filter((t) => t.handovers.length > 0).length} ·{' '}
            <Link href="/workspace/tasks/team" style={{ color: 'var(--purple)' }}>Team Tasks →</Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="pill">status: {sp.status ?? 'all'}</span>
          <ModalForm
            title="Add task"
            trigger="＋ Add task"
            action={createTask}
            fields={taskFields(projects, users).filter((f) => f.name !== 'id')}
          />
        </div>
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Task</th><th>Project</th><th>Owner → assignee</th><th>Status</th><th>Priority</th><th>Due</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr><td colSpan={7} className="empty">No personal tasks{query || statusFilter ? ' match these filters' : ''}.</td></tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    {t.description ? <div className="itemsub">{t.description.length > 90 ? `${t.description.slice(0, 90)}…` : t.description}</div> : null}
                    <div className="itemsub">
                      {t._count.comments > 0 ? `💬 ${t._count.comments} ` : ''}
                      {t._count.deliverables > 0 ? `▣ ${t._count.deliverables} ` : ''}
                      {t.completedAt ? `✓ ${formatDate(t.completedAt)}` : ''}
                    </div>
                  </td>
                  <td><div className="itemsub">{t.project?.name ?? '—'}</div></td>
                  <td>
                    <div>{t.assignee?.name ?? 'Unassigned'}</div>
                    <div className="itemsub">orig: {t.originalOwner?.name ?? t.assignee?.name ?? '—'}</div>
                    {t.handovers.map((h) => (
                      <HandoverButtons
                        key={h.id}
                        requestId={h.id}
                        requesterName={h.requester.name}
                        requesterId={h.requesterId}
                        canDecide={t.assigneeId === meId || role === 'ADMIN'}
                      />
                    ))}
                  </td>
                  <td>
                    <InlineSelect value={t.status} field="status" id={t.id} action={updateTaskInline} options={STATUS.map((s) => ({ value: s, label: labelize(s) }))} alwaysNotify />
                  </td>
                  <td>
                    <InlineSelect value={t.priority} field="priority" id={t.id} action={updateTaskInline} options={PRIORITY.map((p) => ({ value: p, label: labelize(p) }))} className="fieldselect" alwaysNotify />
                  </td>
                  <td style={{ color: t.status !== 'DONE' && t.dueDate && t.dueDate < new Date() ? 'var(--acid)' : undefined }}>{formatDate(t.dueDate)}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <TaskActions
                      taskId={t.id}
                      title={t.title}
                      meId={meId}
                      isAdmin={role === 'ADMIN'}
                      assigneeId={t.assigneeId}
                      ownerId={t.originalOwnerId}
                      status={t.status}
                      eligible={t.eligibleForHandover}
                      pendingForMe={t.assigneeId === meId && t.handovers.length > 0}
                      iRequested={iRequested.has(t.id)}
                    />
                    <ModalForm
                      title="Edit task"
                      trigger="✎"
                      triggerClass="btn sq"
                      action={updateTask}
                      fields={taskFields(projects, users, { id: t.id, title: t.title, description: t.description, projectId: t.projectId, assigneeId: t.assigneeId, priority: t.priority, status: t.status, startDate: t.startDate, dueDate: t.dueDate })}
                    />
                    <ConfirmAction action={deleteTask} payload={t.id} label="Delete task" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
