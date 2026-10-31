import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { deleteFile } from '@/lib/actions';
import FileUploader from '@/components/FileUploader';
import ConfirmAction from '@/components/ConfirmAction';
import MoveAsset, { type Company, type Link } from '@/components/MoveAsset';
import FileLeadImport from './FileLeadImport';
import WebhookManager from './WebhookManager';

export const dynamic = 'force-dynamic';

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'library', label: 'Unassigned' },
  { key: 'project', label: 'Projects' },
  { key: 'task', label: 'Tasks' },
  { key: 'lead', label: 'Leads' },
];

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string; id?: string }> }) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const tab = ['all', 'library', 'project', 'task', 'lead'].includes(sp.tab ?? '') ? (sp.tab || 'all') : 'all';
  const focusId = /^[a-z0-9]{6,40}$/i.exec(sp.id ?? '') ? sp.id : null;
  const session = await auth();
  const userId = session!.user.id;
  const isAdmin = session!.user.role === 'ADMIN';

  let where: Prisma.FileAssetWhereInput = query ? { name: { contains: query, mode: 'insensitive' } } : {};
  if (tab === 'library') where = { projectId: null, taskId: null };
  else if (tab === 'project') where = { projectId: focusId ?? { not: null } };
  else if (tab === 'task') where = { taskId: focusId ?? { not: null } };
  else if (tab === 'lead') where = { leadLinks: { some: { kind: 'LEAD', ...(focusId ? { leadId: focusId } : {}) } } };

  const [files, projects, tasks, leads] = await Promise.all([
    db.fileAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 400,
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, project: { select: { name: true } } } },
        leadLinks: { where: { kind: 'LEAD' }, include: { lead: { select: { id: true, name: true } } } },
        webhook: { select: { id: true, name: true } },
      },
    }),
    db.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 200 }),
    db.task.findMany({ where: { deletedAt: null }, select: { id: true, title: true, project: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.lead.findMany({ select: { id: true, name: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
  ]);

  const projectOpts = projects.map((p) => ({ id: p.id, label: p.name }));
  const taskOpts = tasks.map((t) => ({ id: t.id, label: t.project?.name ? `${t.title} · ${t.project.name}` : t.title }));
  const leadOpts: Company[] = leads.map((l) => ({ id: l.id, label: l.name, kind: 'LEAD' as const }));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>File storage</h2>
          <div className="sub">Max 10 MB. One home (Library / Project / Task) + any number of linked companies.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <WebhookManager />
          <FileUploader projects={projects} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <a
            key={t.key}
            href={`/workspace/files?tab=${t.key}`}
            className={`btn sq${tab === t.key ? ' primary' : ''}`}
            aria-current={tab === t.key ? 'page' : undefined}
          >
            {t.label}
          </a>
        ))}
        {focusId && tab !== 'all' && tab !== 'library' ? (
          <a href={`/workspace/files?tab=${tab}`} className="btn sq">✕ clear focus</a>
        ) : null}
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>File</th><th>Size</th><th>Type</th><th>Used in</th><th>Source</th><th>Uploaded</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr><td colSpan={7} className="empty">{query ? 'No files match your search.' : 'No files in this view yet.'}</td></tr>
            ) : (
              files.map((f) => {
                const homeLabel = f.task ? (f.task.project?.name ? `Task — ${f.task.title} · ${f.task.project.name}` : `Task — ${f.task.title}`)
                  : f.project ? `Project — ${f.project.name}`
                  : 'Library (unassigned)';
                const companies: Link[] = f.leadLinks.map((link) => ({ id: link.lead?.id ?? link.leadId ?? '', label: link.lead?.name ?? 'lead', kind: 'LEAD' as const, linkId: link.id })).filter((c) => c.id);
                const current = {
                  home: { kind: f.task ? ('task' as const) : f.project ? ('project' as const) : ('library' as const), id: f.task?.id ?? f.project?.id },
                  links: companies,
                };
                return (
                  <tr key={f.id}>
                    <td><strong>{f.name}</strong></td>
                    <td>{human(f.size)}</td>
                    <td><div className="itemsub">{f.mimeType}</div></td>
                    <td>
                      {f.task ? <span className="pill"><a href={`/workspace/files?tab=task&id=${f.task.id}`} style={{ color: 'var(--acid)' }}>{homeLabel}</a></span>
                      : f.project ? <span className="pill"><a href={`/workspace/files?tab=project&id=${f.project.id}`} style={{ color: 'var(--acid)' }}>{homeLabel}</a></span>
                      : <span className="pill">{homeLabel}</span>}
                      {companies.length ? (
                        <div className="itemsub" style={{ marginTop: 4 }}>
                          Companies: {companies.slice(0, 3).map((c) => c.label).join(', ')}{companies.length > 3 ? ` +${companies.length - 3}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td>{f.webhook ? <span className="pill">{f.webhook.name}</span> : <span className="itemsub">Manual upload</span>}</td>
                    <td>{formatDate(f.createdAt)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <a className="btn sq" href={`/api/files/${f.id}`} aria-label={`Download ${f.name}`}>↓</a>
                      {isAdmin && (f.mimeType === 'text/csv' || /\.(xlsx|xls)$/i.test(f.name)) ? <FileLeadImport assetId={f.id} fileName={f.name} /> : null}
                      {isAdmin || f.uploadedById === userId ? (
                        <MoveAsset
                          assetId={f.id}
                          assetName={f.name}
                          home={current.home}
                          links={current.links}
                          projects={projectOpts}
                          tasks={taskOpts}
                          leads={leadOpts}
                          compact
                        />
                      ) : null}
                      <ConfirmAction action={deleteFile} payload={f.id} label={`Delete ${f.name}`} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
