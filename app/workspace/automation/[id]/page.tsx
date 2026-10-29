import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { labelize, formatDate } from '@/lib/format';
import { addPhase, assembleDelivery } from '@/lib/actions';
import ModalForm from '@/components/ModalForm';
import PhaseActions from './PhaseActions';
import { AcceptDelivery, ReviewButtons } from './AutomationClient';
import type { FieldSpec } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export default async function AutomationProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const me = session?.user?.id as string;
  const role = (session?.user?.role ?? 'MEMBER') as string;

  const [project, users] = await Promise.all([
    db.automationProject.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true } },
        maintainer: { select: { name: true } },
        websiteProject: { select: { id: true, name: true } },
        phases: {
          orderBy: { order: 'asc' },
          include: {
            owner: { select: { name: true } },
            dependsOn: { select: { title: true, status: true } },
            submissions: {
              orderBy: { version: 'desc' },
              include: { author: { select: { name: true } }, reviewer: { select: { name: true } } },
            },
            deliverables: { select: { id: true, title: true, status: true } },
          },
        },
      },
    }),
    db.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!project) notFound();
  const otherUsers = users.filter((u) => u.id !== me);

  const isOwner = project.ownerId === me || role === 'ADMIN';
  const approved = project.phases.filter((ph) => ph.status === 'APPROVED').length;
  const progress = project.phases.length ? Math.round((approved / project.phases.length) * 100) : 0;
  const delivery = (project.finalDelivery ?? null) as { pending?: boolean; assembledById?: string; assembledAt?: string; repoUrl?: string | null; websiteUrl?: string | null; notes?: string | null; phasesTotal?: number; phasesApproved?: number } | null;
  const deliveryAccepted = Boolean(project.deliveryAcceptedById || project.deliveryAcceptedAt);

  const phaseFields = (): FieldSpec[] => {
    const openPhases = project.phases.filter((ph) => ph.status === 'APPROVED' || ph.status === 'IN_PROGRESS');
    return [
      { label: 'Phase title', name: 'title', required: true, value: '' },
      { label: 'Owner', name: 'ownerId', type: 'select', options: [{ value: '', label: 'Me' }, ...otherUsers.map((u) => ({ value: u.id, label: u.name }))], value: '' },
      { label: 'Due date', name: 'dueDate', type: 'date', value: '' },
      { label: 'Depends on phase', name: 'dependsOnId', type: 'select', full: true, options: [{ value: '', label: 'Nothing (parallel start)' }, ...openPhases.map((ph) => ({ value: ph.id, label: `${ph.title} (${labelize(ph.status)})` }))], value: '' },
      { label: 'Requirements / what must be built', name: 'description', type: 'text', full: true, value: '' },
    ];
  };

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>{project.name}</h2>
          <div className="sub">
            owner {project.owner?.name ?? '—'} · maintainer {project.maintainer?.name ?? 'none'} · {project.phases.length} phases ·{' '}
            <Link href="/workspace/automation" style={{ color: 'var(--purple)' }}>all projects →</Link>
            {project.githubRepo ? <> · repo {project.githubRepo}</> : null}
            {project.websiteProject ? <> · <Link href={`/workspace/projects/${project.websiteProject.id}`} style={{ color: 'var(--purple)' }}>{project.websiteProject.name}</Link></> : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 160, height: 8, background: 'rgba(128,128,128,.2)', borderRadius: 4 }}>
            <div style={{ width: `${progress}%`, height: 8, background: 'var(--purple)', borderRadius: 4 }} />
          </div>
          <span className="pill">{progress}% approved</span>
          {isOwner ? <ModalForm title="Add phase" trigger="＋ Phase" action={addPhase} fields={phaseFields()} hidden={{ projectId: project.id }} /> : null}
        </div>
      </div>

      {delivery ? (
        <div className="tablewrap" style={{ marginBottom: 12 }}>
          <table className="table">
            <thead><tr><th>Final delivery</th><th>Status</th><th>Assembled</th><th>Accepted</th></tr></thead>
            <tbody>
              <tr>
                <td>
                  <div>{delivery.notes ?? '—'}</div>
                  {delivery.repoUrl ? <div className="itemsub">repo: <a href={delivery.repoUrl} style={{ color: 'var(--purple)' }}>open ↗</a></div> : null}
                  {delivery.websiteUrl ? <div className="itemsub">site: <a href={delivery.websiteUrl} style={{ color: 'var(--purple)' }}>open ↗</a></div> : null}
                </td>
                <td>
                  <span className="pill" style={deliveryAccepted ? { color: 'var(--green)' } : undefined}>{deliveryAccepted ? 'accepted' : 'awaiting acceptance'}</span>
                  {delivery.pending && !deliveryAccepted ? <div className="itemsub">{delivery.phasesApproved ?? 0}/{delivery.phasesTotal ?? 0} phases approved</div> : null}
                </td>
                <td>{delivery.assembledAt ? formatDate(decodeAssembledAt(delivery.assembledAt)) : '—'}</td>
                <td>{deliveryAccepted ? formatDate(project.deliveryAcceptedAt) : 'pending'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Phase</th><th>Owner</th><th>Depends on</th><th>Due</th><th>Status</th><th>Submissions</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {project.phases.length === 0 ? (
              <tr><td colSpan={7} className="empty">No phases yet — add the first phase gate.</td></tr>
            ) : (
              project.phases.map((ph) => {
                const latest = ph.submissions[0];
                const canSubmit = (ph.ownerId === me || project.ownerId === me || role === 'ADMIN') && ph.status !== 'APPROVED';
                const dependency = ph.dependsOn;
                const blocked = dependency && dependency.status !== 'APPROVED';
                return (
                  <tr key={ph.id}>
                    <td>
                      <strong>{ph.title}</strong>
                      {ph.description ? <div className="itemsub">{ph.description.length > 120 ? `${ph.description.slice(0, 120)}…` : ph.description}</div> : null}
                      {ph.deliverables.length > 0 ? <div className="itemsub">▣ {ph.deliverables.length} deliverable(s)</div> : null}
                    </td>
                    <td>{ph.owner?.name ?? '—'}</td>
                    <td>{dependency ? <span className="itemsub">{dependency.title} · {labelize(dependency.status)}</span> : '—'}</td>
                    <td style={{ color: !blocked && ph.dueDate && ph.status !== 'APPROVED' && ph.dueDate < new Date() ? 'var(--acid)' : undefined }}>{formatDate(ph.dueDate)}</td>
                    <td><span className="pill" style={ph.status === 'APPROVED' ? { color: 'var(--green)' } : ph.status === 'CHANGES_REQUESTED' ? { color: 'var(--acid)' } : undefined}>{labelize(ph.status)}</span></td>
                    <td>
                      {latest ? (
                        <>
                          <div>v{latest.version} · {latest.author?.name ?? '—'}</div>
                          <div className="itemsub">{latest.status} {latest.reviewer?.name ? `· ${latest.reviewer.name}` : ''}</div>
                          {latest.notes ? <div className="itemsub">{latest.notes.length > 90 ? `${latest.notes.slice(0, 90)}…` : latest.notes}</div> : null}
                        </>
                      ) : (
                        <span className="itemsub">no submission</span>
                      )}
                    </td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {canSubmit ? <PhaseActions phaseId={ph.id} blocked={Boolean(blocked)} /> : null}
                      {isOwner && latest && ph.status !== 'APPROVED' ? <ReviewButtons submissionId={latest.id} phaseTitle={ph.title} /> : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isOwner ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <ModalForm
            title="Assemble final delivery"
            trigger="⇉ Assemble final delivery"
            action={assembleDelivery}
            fields={[
              { label: 'Repo URL (GitHub release, production repo…)', name: 'repoUrl', value: '' },
              { label: 'Website URL', name: 'websiteUrl', value: '' },
              { label: 'Handover notes — what the client receives', name: 'notes', type: 'text', full: true, value: '' },
            ]}
            hidden={{ projectId: project.id }}
          />
          <AcceptDelivery projectId={project.id} disabled={Boolean(!delivery || deliveryAccepted)} />
        </div>
      ) : null}
    </>
  );
}

function decodeAssembledAt(v: string): Date {
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
