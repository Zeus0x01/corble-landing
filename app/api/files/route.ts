import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { saveUpload, hasS3 } from '@/lib/storage';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv', 'application/json', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: 'Invalid upload' }, { status: 400 });
  }
  const file = form.get('file');
  const projectIdRaw = form.get('projectId');
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: 'File is larger than 10 MB' }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ ok: false, error: `Unsupported type: ${file.type}` }, { status: 415 });
  }
  const projectId = typeof projectIdRaw === 'string' && projectIdRaw ? projectIdRaw : null;
  if (projectId) {
    const exists = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!exists) return Response.json({ ok: false, error: 'Project not found' }, { status: 400 });
  }

  try {
    const { storageKey, storage } = await saveUpload(file);
    const asset = await db.fileAsset.create({
      data: {
        name: file.name.slice(0, 160),
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        storageKey,
        storage,
        projectId,
        uploadedById: session.user.id,
      },
    });
    await db.activity.create({
      data: { userId: session.user.id, message: 'File uploaded', detail: asset.name },
    });
    revalidatePath('/workspace/files');
    return Response.json({ ok: true, id: asset.id, backend: hasS3() ? 's3' : 'local' });
  } catch {
    return Response.json(
      { ok: false, error: 'Storage error — configure S3 env vars or ensure ./uploads is writable.' },
      { status: 500 },
    );
  }
}

