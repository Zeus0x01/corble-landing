import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { n8nConfigured, n8nMissing } from '@/lib/n8n';
import N8nPanel from './N8nPanel';

export const dynamic = 'force-dynamic';

export default async function N8nPage() {
  const session = await auth();
  const role = (session?.user?.role ?? 'MEMBER') as string;
  const admin = role === 'ADMIN';

  const jsonAssets = admin
    ? await db.fileAsset.findMany({
        where: { mimeType: 'application/json' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, name: true, size: true, createdAt: true },
      })
    : [];

  const assets = jsonAssets.map((a) => ({
    id: a.id,
    name: a.name,
    size: a.size,
    at: a.createdAt.toISOString(),
  }));

  const missing = n8nMissing();

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>n8n Workflows</h2>
          <div className="sub">
            Browse the connected n8n instance, export workflows into the Files library, and import a library JSON back into n8n as a new workflow.
          </div>
        </div>
      </div>
      <N8nPanel
        admin={admin}
        configured={n8nConfigured()}
        missing={[missing.baseUrl ? 'N8N_BASE_URL' : '', missing.apiKey ? 'N8N_API_KEY' : ''].filter(Boolean).join(', ')}
        assets={assets}
      />
    </>
  );
}
