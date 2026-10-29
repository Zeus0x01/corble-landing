import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { listRepos, githubConfigured } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if ((session?.user?.role ?? 'MEMBER') !== 'ADMIN') {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!githubConfigured()) {
    return Response.json({ ok: false, error: 'GITHUB_TOKEN is not set in server env.' }, { status: 503 });
  }
  try {
    const repos = await listRepos();
    return Response.json({ ok: true, repos, truncated: repos.length >= 100 });
  } catch (e) {
    console.error('repo list error', e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: 'Repo listing failed.' }, { status: 500 });
  }
}
