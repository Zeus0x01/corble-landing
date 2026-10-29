import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { deleteFile } from '@/lib/actions';
import FileUploader from '@/components/FileUploader';
import ConfirmAction from '@/components/ConfirmAction';
import MoveAsset from '@/components/MoveAsset';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const TABS = [
  { key: '', label: 'All' },
  { key: 'library', label: 'Unassigned' },
  { key: 'project', label: 'Projects' },
  { key: 'task', label: 'Tasks' },
  { key: 'lead', label: 'Leads' },
];

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const { q, tab } = await searchParams;
  const query = (q ?? '').trim();
  const home = (tab ?? '').trim();
  const session = await auth();
  const userId = session!.user.id;
  const isAdmin = session!.user.role === 'ADMIN';

  const where = query ? { name: { contains: query, mode: 'insensitive' as const } } : {};
  const [files, projects, tasks, leads] = await Promise.all([
    db.fileAsset.findMany({
      where: home === 'library' ? { ...where, projectId: null, taskId: null, leadId: null } : home === 'project' ? { ...where, projectId: { not: null } } : home === 'task' ? { ...where, taskId: { not: null } } : home === 'lead' ? { ...where, leadId: { not: null } } : where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, project: { select: { name: true } } } },
        lead: { select: { id: true, name: true } },
      },
      take: 400,
    }),
    db.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 200 }),
    db.task.findMany({ select: { id: true, title: true, project: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.lead.findMany({ select: { id: true, name: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
  ]);

  const projectOpts = projects.map((p) => ({ id: p.id, label: p.name }));
  const taskOpts = tasks.map((t) => ({ id: t.id, label: t.project?.name ? `${t.title} · ${t.project.name}` : t.title }));
  const leadOpts = leads.map((l) => ({ id: l.id, label: l.name }));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>File storage</h2>
          <div className="sub">Max 10 MB. Attach a file to a Project, Task or Lead — or keep it in the shared library.</div>
        </div>
        <FileUploader projects={projects} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <Link
            key={t.key || 'all'}
            href={`/workspace/files${t.key ? `?tab=${t.key}` : ''}`}
            className={`btn sq${(home || '') === t.key ? ' primary' : ''}`}
            aria-current={(home || '') === t.key ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>File</th><th>Size</th><th>Type</th><th>Used in</th><th>Uploaded</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr><td colSpan={6} className="empty">{query ? 'No files match your search.' : 'No files uploaded yet.'}</td></tr>
            ) : (
              files.map((f) => {
                const homeLabel = f.task ? (f.task.project?.name ? `Task — ${f.task.title} · ${f.task.project.name}` : `Task — ${f.task.title}`)
                  : f.lead ? `Lead — ${f.lead.name}`
                  : f.project ? `Project — ${f.project.name}`
                  : 'Library (unassigned)';
                const current = `lead:${f.leadId ?? ''}|task:${f.taskId ?? ''}|project:${f.projectId ?? ''}`;
                return (
                  <tr key={f.id}>
                    <td><strong>{f.name}</strong></td>
                    <td>{human(f.size)}</td>
                    <td><div className="itemsub">{f.mimeType}</div></td>
                    <td><span className="pill">{homeLabel}</span></td>
                    <td>{formatDate(f.createdAt)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <a className="btn sq" href={`/api/files/${f.id}`} aria-label={`Download ${f.name}`}>↓</a>
                      {isAdmin || f.uploadedById === userId ? (
                        <MoveAsset
                          assetId={f.id}
                          assetName={f.name}
                          current={current}
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
