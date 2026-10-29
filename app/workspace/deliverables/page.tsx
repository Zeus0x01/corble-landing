import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { labelize, formatDate } from '@/lib/format';
import { submitDeliverable, submitNewVersion } from '@/lib/actions';
import ModalForm from '@/components/ModalForm';
import ReviewForm from './ReviewForm';
import type { FieldSpec } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'] as const;

export default async function DeliverablesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const session = await auth();
  const me = session?.user?.id as string;
  const role = (session?.user?.role ?? 'MEMBER') as string;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as never) ? (sp.status as (typeof STATUSES)[number]) : null;
  const query = (sp.q ?? '').trim();

  const filters: Prisma.DeliverableWhereInput[] = [];
  if (role !== 'ADMIN') filters.push({ OR: [{ createdById: me }, { versions: { some: { submittedById: me } } }] });
  if (status) filters.push({ status });
  if (query) filters.push({ title: { contains: query, mode: 'insensitive' } });

  const [deliverables, myTasks] = await Promise.all([
    db.deliverable.findMany({
      where: filters.length ? { AND: filters } : {},
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        task: { select: { title: true, project: { select: { name: true } } } },
        phase: { select: { title: true } },
        createdBy: { select: { name: true } },
        versions: {
          orderBy: { version: 'desc' },
          include: { submittedBy: { select: { name: true } }, reviews: { orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { name: true } } } } },
        },
      },
    }),
    db.task.findMany({
      where: { assigneeId: me },
      select: { id: true, title: true, status: true },
      orderBy: { title: 'asc' },
    }),
  ]);

  const fields = (): FieldSpec[] => [
    { label: 'Task', name: 'taskId', type: 'select', required: true, full: true, options: myTasks.map((t) => ({ value: t.id, label: `${t.title} (${labelize(t.status)})` })) },
    { label: 'Deliverable title', name: 'title', required: true, value: '' },
    { label: 'Link (Google Doc, repo, design file…)', name: 'externalUrl', value: '' },
    { label: 'Body — what you delivered', name: 'body', type: 'text', full: true, required: true, value: '' },
  ];

  const versionFields = (d: { id: string; title: string; latest: string }): FieldSpec[] => [
    { label: 'Deliverable ID', name: 'taskId', type: 'text', required: true, full: true, value: d.id },
    { label: 'Link (updated work)', name: 'externalUrl', value: d.latest },
    { label: 'Body — what changed in this version', name: 'body', type: 'text', full: true, required: true, value: '' },
  ];

  const counts = {
    review: deliverables.filter((d) => d.status === 'UNDER_REVIEW' || d.status === 'SUBMITTED').length,
    changes: deliverables.filter((d) => d.status === 'CHANGES_REQUESTED').length,
    approved: deliverables.filter((d) => d.status === 'APPROVED').length,
  };

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Deliverables</h2>
          <div className="sub">
            {deliverables.length} tracked · {counts.review} awaiting review · {counts.changes} need changes · {counts.approved} approved ·{' '}
            <Link href="/workspace/tasks" style={{ color: 'var(--purple)' }}>My Tasks →</Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {status && <a className="btn" href="/workspace/deliverables">Clear filter</a>}
          <ModalForm
            title={myTasks.length === 0 ? 'No open tasks to deliver' : 'Submit deliverable'}
            trigger="＋ Submit deliverable"
            action={submitDeliverable}
            fields={fields()}
          />
        </div>
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Deliverable</th><th>Task / project</th><th>Latest version</th><th>Status</th><th>Latest review</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {deliverables.length === 0 ? (
              <tr><td colSpan={6} className="empty">No deliverables yet — submit work from one of your tasks.</td></tr>
            ) : (
              deliverables.map((d) => {
                const latest = d.versions[0];
                const review = latest?.reviews[0] ?? null;
                const canVersion = role === 'ADMIN' || d.createdById === me || d.versions.some((v) => v.submittedById === me);
                return (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.title}</strong>
                      {latest?.externalUrl ? (
                        <div className="itemsub">
                          <a href={latest.externalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)' }}>work link ↗</a>
                        </div>
                      ) : null}
                      {latest?.body ? <div className="itemsub">{latest.body.length > 110 ? `${latest.body.slice(0, 110)}…` : latest.body}</div> : null}
                    </td>
                    <td>
                      <div>{d.task?.title ?? d.phase?.title ?? '—'}</div>
                      <div className="itemsub">{d.task?.project?.name ?? ''}</div>
                    </td>
                    <td>
                      {latest ? (
                        <>
                          <div>v{latest.version} · {latest.submittedBy?.name ?? d.createdBy?.name ?? '—'}</div>
                          <div className="itemsub">{formatDate(latest.submittedAt)}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td>
                      <span className="pill" style={d.status === 'CHANGES_REQUESTED' || d.status === 'REJECTED' ? { color: 'var(--acid)' } : d.status === 'APPROVED' ? { color: 'var(--green)' } : undefined}>
                        {labelize(d.status)}
                      </span>
                    </td>
                    <td>
                      {review ? (
                        <>
                          <div className="itemsub">{review.reviewer?.name ?? 'reviewer'} · {labelize(review.decision)}</div>
                          {review.comment ? <div className="itemsub">“{review.comment}”</div> : null}
                        </>
                      ) : (
                        <span className="itemsub">not reviewed</span>
                      )}
                    </td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <ReviewForm versionId={latest?.id ?? ''} status={d.status} />
                      {canVersion && latest ? (
                        <ModalForm title={`New version — ${d.title}`} trigger="⤒ version" triggerClass="btn" action={submitNewVersion} fields={versionFields({ id: d.id, title: d.title, latest: latest.externalUrl ?? '' })} />
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="sub" style={{ padding: '8px 2px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        Filters:
        {STATUSES.map((s) => (
          <a key={s} href={`/workspace/deliverables?status=${s}`} style={{ color: 'var(--purple)' }}>{labelize(s)}</a>
        ))}
      </div>
    </>
  );
}
