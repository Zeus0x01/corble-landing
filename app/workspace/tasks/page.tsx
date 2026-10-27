import Link from 'next/link';
import { db } from '@/lib/db';
import { labelize, formatDate, toISODate } from '@/lib/format';
import { createTask, deleteTask, updateTask, updateTaskInline } from '@/lib/actions';
import InlineSelect from '@/components/InlineSelect';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';
import type { FieldSpec } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const STATUS = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const;
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH'] as const;

function taskFields(
  projects: { id: string; name: string }[],
  users: { id: string; name: string }[],
  edit?: { id: string; title: string; projectId: string | null; assigneeId: string | null; priority: string; status: string; dueDate: Date | null },
): FieldSpec[] {
  return [
    { label: 'Task title', name: 'title', required: true, value: edit?.title },
    { label: 'Project', name: 'projectId', type: 'select', options: [{ value: '', label: 'None' }, ...projects.map((p) => ({ value: p.id, label: p.name }))], value: edit?.projectId ?? '' },
    { label: 'Assignee', name: 'assigneeId', type: 'select', options: [{ value: '', label: 'Unassigned' }, ...users.map((u) => ({ value: u.id, label: u.name }))], value: edit?.assigneeId ?? '' },
    { label: 'Priority', name: 'priority', type: 'select', options: PRIORITY.map((p) => ({ value: p, label: labelize(p) })), value: edit?.priority },
    { label: 'Status', name: 'status', type: 'select', options: STATUS.map((s) => ({ value: s, label: labelize(s) })), value: edit?.status },
    { label: 'Due date', name: 'dueDate', type: 'date', value: edit?.dueDate ? toISODate(edit.dueDate) : '' },
    { label: 'Record ID', name: 'id', type: 'text', required: true, full: true, value: edit?.id ?? 'auto' },
  ];
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; assignee?: string }> }) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const statusFilter = STATUS.includes(sp.status as never) ? (sp.status as (typeof STATUS)[number]) : null;

  const tasks = await db.task.findMany({
    where: {
      AND: [
        query ? { title: { contains: query, mode: 'insensitive' } } : {},
        statusFilter ? { status: statusFilter } : {},
      ],
    },
    orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
    include: { project: { select: { name: true } }, assignee: { select: { name: true } } },
  });
  const [projects, users] = await Promise.all([
    db.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Task list</h2>
          <div className="sub">Filter, reassign, and complete tasks inline. <Link href="/workspace/tasks" style={{ color: 'var(--purple)' }}>Clear filters</Link></div>
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
            <tr><th>Task</th><th>Project</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr><td colSpan={7} className="empty">{query || statusFilter ? 'No tasks match these filters.' : 'Nothing on the board — add a task.'}</td></tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.title}</strong></td>
                  <td><div className="itemsub">{t.project?.name ?? '—'}</div></td>
                  <td>{t.assignee?.name ?? 'Unassigned'}</td>
                  <td>
                    <InlineSelect value={t.status} field="status" id={t.id} action={updateTaskInline} options={STATUS.map((s) => ({ value: s, label: labelize(s) }))} alwaysNotify />
                  </td>
                  <td>
                    <InlineSelect value={t.priority} field="priority" id={t.id} action={updateTaskInline} options={PRIORITY.map((p) => ({ value: p, label: labelize(p) }))} className="fieldselect" alwaysNotify />
                  </td>
                  <td>{formatDate(t.dueDate)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <ModalForm
                      title="Edit task"
                      trigger="✎"
                      triggerClass="btn sq"
                      action={updateTask}
                      fields={taskFields(projects, users, { id: t.id, title: t.title, projectId: t.projectId, assigneeId: t.assigneeId, priority: t.priority, status: t.status, dueDate: t.dueDate })}
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
