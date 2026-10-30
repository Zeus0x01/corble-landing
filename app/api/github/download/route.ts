import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { listTree, readTextFile, safeRepoPath } from '@/lib/github';
import { buildZip } from '@/lib/zip';

export const dynamic = 'force-dynamic';

const MAX_ZIP_BYTES = 20_000_000;

// GET ?conn=..&paths=a.js,b/c.md  → single file stream or ZIP preserving folder structure
export async function GET(req: NextRequest) {
  const session = await dbUser();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const connId = req.nextUrl.searchParams.get('conn') ?? '';
  const pathsParam = req.nextUrl.searchParams.get('paths') ?? '';
  const dir = req.nextUrl.searchParams.get('dir') ?? '';
  const conn = connId ? await db.gitHubConnection.findUnique({ where: { id: connId } }) : null;
  if (!conn) return new Response('Connection not found', { status: 404 });

  const paths = new Set<string>();
  for (const p of pathsParam.split(',')) if (p && safeRepoPath(p)) paths.add(p);
  try {
    if (!paths.size && dir) {
      const entries = await listTree(conn.owner, conn.repo, conn.branch, dir);
      entries.filter((e) => e.type === 'file').forEach((e) => paths.add(e.path));
    }
    if (!paths.size) return new Response('Nothing to download', { status: 400 });

    if (paths.size === 1) {
      const only = [...paths][0];
      const content = await readTextFile(conn.owner, conn.repo, conn.branch, only);
      return new Response(content, {
        headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${only.split('/').pop()}"` },
      });
    }

    if (paths.size > 40) return new Response('Too many files (max 40)', { status: 400 });
    const entries: { name: string; bytes: Uint8Array }[] = [];
    let size = 0;
    for (const p of paths) {
      const content = await readTextFile(conn.owner, conn.repo, conn.branch, p);
      const bytes = new TextEncoder().encode(content);
      size += bytes.length;
      if (size > MAX_ZIP_BYTES) return new Response('Zip too large', { status: 413 });
      entries.push({ name: p, bytes });
    }
    const zip = buildZip(entries);
    return new Response(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${conn.repo}-${conn.branch}.zip"`,
      },
    });
  } catch (e) {
    const status = e instanceof Error && e.message.startsWith('GITHUB 404') ? 404 : 502;
    return new Response(e instanceof Error ? e.message : 'Download failed', { status });
  }
}
