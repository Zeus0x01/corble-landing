import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { readLocalUpload } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await dbUser();
  if (!me) return new Response('Unauthorized', { status: 401 });

  const asset = await db.fileAsset.findUnique({ where: { id } });
  if (!asset) return new Response('Not found', { status: 404 });

  if (asset.storage === 's3') {
    return new Response('Use the presigned URL link on the Files page.', { status: 308 });
  }
  if (process.env.NODE_ENV === 'production' && asset.storage === 'local') {
    return new Response('Local storage is only available in development. Configure S3 env vars.', { status: 410 });
  }

  const buf = await readLocalUpload(asset.storageKey);
  if (!buf) return new Response('File missing on disk', { status: 410 });

  return new Response(new Uint8Array(buf), {
    headers: {
      'content-type': asset.mimeType,
      'content-disposition': `attachment; filename="${asset.name.replace(/"/g, '')}"`,
      'content-length': String(buf.byteLength),
    },
  });
}
