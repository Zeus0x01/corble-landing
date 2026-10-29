import Link from 'next/link';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { labelize } from '@/lib/format';
import { createAutomation, addPhase } from '@/lib/actions';
import ModalForm from '@/components/ModalForm';
import type { FieldSpec } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export default async function AutomationPage() {
  const session = await auth();
  const me = session?.user?.id as string;
  const role = (session?.user?.role ?? 'MEMBER') as string;

  const [projects, users, webProjects] = await Promise.all([
    db.automationProject.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        owner: { select: { name: true } },
        maintainer: { select: { name: true } },
        websiteProject: { select: { id: true, name: true } },
        phases: { select: { id: true, title: true, status: true, order: true, dueDate: true, ownerId: true, dependsOnId: true } },
      },
    }),
    db.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const otherUsers = users.filter((u) => u.id !== me);

  const createFields: FieldSpec[] = [
    { label: 'Automation name', name: 'name', required: true, value: '' },
    { label: 'Owner', name: 'ownerId', type: 'select', options: [{ value: '', label: 'Me' }, ...otherUsers.map((u) => ({ value: u.id, label: u.name }))], value: '' },
    { label: 'Maintainer', name: 'maintainerId', type: 'select', options: [{ value: '', label: 'None yet' }, ...users.map((u) => ({ value: u.id, label: u.name }))], value: '' },
    { label: 'GitHub repo (oecd/repo format)', name: 'githubRepo', value: '' },
    { label: 'Website project link', name: 'websiteProjectId', type: 'select', full: true, options: [{ value: '', label: 'None' }, ...webProjects.map((p) => ({ value: p.id, label: p.name }))], value: '' },
    { label: 'Description', name: 'description', type: 'text', full: true, value: '' },
  ];

  function progressOf(phases: { status: string }[]): number {
    if (phases.length === 0) return 0;
    const approved = phases.filter((p) => p.status === 'APPROVED').length;
    return Math.round((approved / phases.length) * 100);
  }

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Automation projects</h2>
          <div className="sub">{projects.length} projects · phases move NOT_STARTED → IN_PROGRESS → SUBMITTED_FOR_REVIEW → APPROVED</div>
        </div>
        <ModalForm title="Create automation project" trigger="＋ New project" action={createAutomation} fields={createFields} />
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Project</th><th>Owner / maintainer</th><th>Phases</th><th>Progress</th><th>Website build</th><th>Status</th></tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr><td colSpan={6} className="empty">No automation projects yet.</td></tr>
            ) : (
              projects.map((p) => {
                const progress = progressOf(p.phases);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong><Link href={`/workspace/automation/${p.id}`} style={{ color: 'var(--purple)' }}>{p.name} →</Link></strong>
                      {p.description ? <div className="itemsub">{p.description}</div> : null}
                      {p.githubRepo ? <div className="itemsub">repo: {p.githubRepo}</div> : null}
                    </td>
                    <td>
                      <div>{p.owner?.name ?? '—'}</div>
                      <div className="itemsub">maintainer: {p.maintainer?.name ?? 'none'}</div>
                    </td>
                    <td>
                      <div className="pill">{p.phases.length}</div>
                    </td>
                    <td style={{ width: 220 }}>
                      <div style={{ width: 180, height: 6, background: 'rgba(128,128,128,.2)', borderRadius: 4 }}>
                        <div style={{ width: `${progress}%`, height: 6, background: 'var(--purple)', borderRadius: 4 }} />
                      </div>
                      <span className="itemsub">{progress}% approved</span>
                    </td>
                    <td>{p.websiteProject ? <Link href={`/workspace/projects/${p.websiteProject.id}`} style={{ color: 'var(--purple)' }}>{p.websiteProject.name}</Link> : '—'}</td>
                    <td>
                      <span className="pill">{labelize(p.status)}</span>
                      {p.finalDelivery ? <div className="itemsub">delivered</div> : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="sub" style={{ padding: '8px 2px' }}>
        {role === 'ADMIN' || projects.some((p) => p.ownerId === me) ? 'You can create phase gates and submit reviews from each project page.' : 'Only admins and project owners can add phases.'}
      </div>
    </>
  );
}
