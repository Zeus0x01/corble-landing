import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { deleteFile } from '@/lib/actions';
import FileUploader from '@/components/FileUploader';
import ConfirmAction from '@/components/ConfirmAction';

export const dynamic = 'force-dynamic';

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const session = await auth();
  const userId = session!.user.id;

  const [files, projects] = await Promise.all([
    db.fileAsset.findMany({
      where: query ? { name: { contains: query, mode: 'insensitive' } } : {},
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { name: true } } },
    }),
    db.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>File storage</h2>
          <div className="sub">Max 10 MB. Stored via S3-compatible storage when configured, local ./uploads otherwise.</div>
        </div>
        <FileUploader projects={projects} />
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>File</th><th>Size</th><th>Type</th><th>Project</th><th>Uploaded</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr><td colSpan={6} className="empty">{query ? 'No files match your search.' : 'No files uploaded yet.'}</td></tr>
            ) : (
              files.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.name}</strong></td>
                  <td>{human(f.size)}</td>
                  <td><div className="itemsub">{f.mimeType}</div></td>
                  <td>{f.project?.name ?? '—'}</td>
                  <td>{formatDate(f.createdAt)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <a className="btn sq" href={`/api/files/${f.id}`} aria-label={`Download ${f.name}`}>↓</a>
                    <ConfirmAction action={deleteFile} payload={f.id} label={`Delete ${f.name}`} />
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
