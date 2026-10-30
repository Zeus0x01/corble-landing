import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { formatMoney, formatDate, labelize, toISODate, progressTone } from '@/lib/format';
import { createProject, deleteProject, setProjectStatus, updateProject } from '@/lib/actions';
import InlineSelect from '@/components/InlineSelect';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';
import type { FieldSpec } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const SERVICES = ['AI Automation', 'Web Development', 'Cybersecurity', 'Website', 'WhatsApp Solutions'];
const STATUS = ['PLANNING', 'IN_PROGRESS', 'REVIEW', 'DELIVERED', 'COMPLETED'] as const;

function projectFields(
  leads: { id: string; leadCode: string; name: string }[],
  owners: { id: string; name: string }[],
  edit?: { id: string; name: string; clientName: string; leadId: string | null; service: string; status: string; progress: number; dueDate: Date | null; ownerId: string | null; budget: number },
): FieldSpec[] {
  const base: FieldSpec[] = [
    { label: 'Project name', name: 'name', required: true, full: true, value: edit?.name },
    { label: 'Client name', name: 'clientName', required: true, value: edit?.clientName },
    { label: 'Service', name: 'service', type: 'select', options: SERVICES.map((s) => ({ value: s, label: s })), value: edit?.service },
    { label: 'Status', name: 'status', type: 'select', options: STATUS.map((s) => ({ value: s, label: labelize(s) })), value: edit?.status },
    { label: 'Progress %', name: 'progress', type: 'number', value: edit?.progress ?? 0 },
    { label: 'Due date', name: 'dueDate', type: 'date', value: edit?.dueDate ? toISODate(edit.dueDate) : '' },
    { label: 'Budget (EGP)', name: 'budget', type: 'number', required: true, value: edit?.budget ?? 0 },
    { label: 'Owner', name: 'ownerId', type: 'select', options: [{ value: '', label: 'Unassigned' }, ...owners.map((o) => ({ value: o.id, label: o.name }))], value: edit?.ownerId ?? '' },
    { label: 'Linked lead', name: 'leadId', type: 'select', options: [{ value: '', label: 'None' }, ...leads.map((l) => ({ value: l.id, label: `${l.leadCode} · ${l.name}` }))], value: edit?.leadId ?? '' },
    { label: 'Record ID', name: 'id', type: 'text', required: true, full: true, value: edit?.id ?? 'auto' },
  ];
  return base;
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const [projects, leadList, owners, fileCounts] = await Promise.all([
    db.project.findMany({
      where: query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { clientName: { contains: query, mode: 'insensitive' } }] } : {},
      orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
      include: { owner: { select: { name: true } }, lead: { select: { leadCode: true } } },
    }),
    db.lead.findMany({ select: { id: true, leadCode: true, name: true }, orderBy: { name: 'asc' } }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.fileAsset.groupBy({ by: ['projectId'], _count: { _all: true }, where: { projectId: { not: null } } }),
  ]);
  const filesByProject = new Map(fileCounts.map((g) => [g.projectId, g._count._all] as const));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Delivery board</h2>
          <div className="sub">Status, progress, owner, budget — instant saves.</div>
        </div>
        {isAdmin ? (
          <ModalForm
            title="New project"
            trigger="＋ New project"
            action={createProject}
            fields={projectFields(leadList, owners).filter((f) => f.name !== 'id')}
          />
        ) : null}
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Project</th><th>Client</th><th>Owner</th><th>Status</th><th>Progress</th><th>Due</th><th>Budget</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr><td colSpan={8} className="empty">{query ? 'No projects match your search.' : 'No projects yet.'}</td></tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><div className="itemsub">{p.service}</div></td>
                  <td>{p.clientName}{p.lead ? <div className="itemsub"><a href={`/workspace/leads?lead=${encodeURIComponent(p.lead.leadCode)}`} style={{ color: 'var(--purple)' }}>{p.lead.leadCode}</a></div> : null}</td>
                  <td>{p.owner?.name ?? '—'}</td>
                  <td>
                    {isAdmin ? (
                      <InlineSelect
                        value={p.status}
                        field="status"
                        id={p.id}
                        action={setProjectStatus}
                        options={STATUS.map((s) => ({ value: s, label: labelize(s) }))}
                        alwaysNotify
                      />
                    ) : <span className="pill">{labelize(p.status)}</span>}
                  </td>
                  <td>
                    <div className="track" style={{ width: 90, display: 'inline-block' }}>
                      <div className="fill" style={{ width: `${p.progress}%`, background: progressTone(p.progress) }} />
                    </div>
                    <small style={{ marginLeft: 6, color: 'var(--muted)' }}>{p.progress}%</small>
                  </td>
                  <td>{formatDate(p.dueDate)}</td>
                  <td>{formatMoney(p.budget)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {(filesByProject.get(p.id) ?? 0) > 0 ? (
                      <a className="btn sq" href={`/workspace/files?tab=project&id=${p.id}`} title={`Open ${filesByProject.get(p.id)} file(s)`}>▤ {filesByProject.get(p.id)}</a>
                    ) : null}
                    {isAdmin ? (
                      <>
                        <ModalForm
                          title="Edit project"
                          trigger="✎"
                          triggerClass="btn sq"
                          action={updateProject}
                          fields={projectFields(leadList, owners, { id: p.id, name: p.name, clientName: p.clientName, leadId: p.leadId, service: p.service, status: p.status, progress: p.progress, dueDate: p.dueDate, ownerId: p.ownerId, budget: p.budget })}
                        />
                        <ConfirmAction action={deleteProject} payload={p.id} label="Delete project" />
                      </>
                    ) : null}
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
