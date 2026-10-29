import { db } from '@/lib/db';
import { AwsClient } from 'aws4fetch';

export type StoredIn = 'local' | 's3';

export function hasS3(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_REGION &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

function s3Client(): AwsClient {
  return new AwsClient({
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    service: 's3',
    region: process.env.S3_REGION || '',
  });
}

function s3ObjectUrl(key: string): string {
  const base = process.env.S3_ENDPOINT?.replace(/\/$/, '') ?? '';
  const bucket = process.env.S3_BUCKET ?? '';
  return `${base}/${bucket}/${key}`;
}

/** Save an uploaded file. Uses S3-compatible storage when configured, else local ./uploads (dev). */
export async function saveUpload(file: File): Promise<{ storageKey: string; storage: StoredIn }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(-120) || 'file';
  const key = `${Date.now()}-${Math.floor(Math.random() * 1e9)}-${safeName}`;

  if (hasS3()) {
    const res = await s3Client().fetch(s3ObjectUrl(key), {
      method: 'PUT',
      body: Buffer.from(await file.arrayBuffer()),
      headers: { 'content-type': file.type || 'application/octet-stream' },
    });
    if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
    return { storageKey: key, storage: 's3' };
  }

  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join(process.cwd(), 'uploads');
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, key), Buffer.from(await file.arrayBuffer()));
  return { storageKey: key, storage: 'local' };
}

/** Save raw text/JSON content produced internally (e.g. workflow exports) as a file asset. */
export async function saveContent(name: string, mimeType: string, content: string): Promise<{ storageKey: string; storage: StoredIn; size: number }> {
  const body = Buffer.from(content, 'utf8');
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(-120) || 'file';
  const key = `${Date.now()}-${Math.floor(Math.random() * 1e9)}-${safeName}`;

  if (hasS3()) {
    const res = await s3Client().fetch(s3ObjectUrl(key), {
      method: 'PUT',
      body,
      headers: { 'content-type': mimeType },
    });
    if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
    return { storageKey: key, storage: 's3', size: body.byteLength };
  }

  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join(process.cwd(), 'uploads');
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, key), body);
  return { storageKey: key, storage: 'local', size: body.byteLength };
}

/** Read back a stored local upload as text (used for file pickers that need contents). */
export async function readStoredText(storageKey: string, storage: string, fallbackUrl?: null): Promise<string | null> {
  if (storage === 'local') {
    const buf = await readLocalUpload(storageKey);
    return buf ? buf.toString('utf8') : null;
  }
  try {
    if (hasS3()) {
      const signed = await s3Client().sign(new Request(s3ObjectUrl(storageKey)), { aws: { signQuery: true } });
      const res = await fetch(signed.url, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.text();
    }
  } catch {
    return null;
  }
  return null;
}

/** Presigned GET URL for S3 storage; local files are streamed by the authenticated route. */
export async function fileDownloadUrl(assetId: string): Promise<string | null> {
  const asset = await db.fileAsset.findUnique({ where: { id: assetId } });
  if (!asset) return null;

  if (asset.storage === 's3') {
    const req = new Request(s3ObjectUrl(asset.storageKey));
    const signed = await s3Client().sign(req, { aws: { signQuery: true } });
    // Cheap, private, short-lived: returns the signed URL directly for download links.
    return asset ? signed.url : null;
  }

  return `/api/files/${assetId}`;
}

export async function readLocalUpload(storageKey: string): Promise<Buffer | null> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'uploads', storageKey);
    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (stat) return await fs.promises.readFile(filePath);
    return null;
  } catch {
    return null;
  }
}
