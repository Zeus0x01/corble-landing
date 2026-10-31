import { auth } from '@/lib/auth';
import { n8nConfigured, n8nMissing } from '@/lib/n8n';
import N8nPanel from './N8nPanel';

export const dynamic = 'force-dynamic';

export default async function N8nPage() {
  const session = await auth();
  const role = (session?.user?.role ?? 'MEMBER') as string;
  const admin = role === 'ADMIN';

  const missing = n8nMissing();

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>n8n Workflows</h2>
          <div className="sub">
            Browse and manage workflows directly from the connected n8n instance. Corble fetches the current workflow list from n8n automatically.
          </div>
        </div>
      </div>
      <N8nPanel
        admin={admin}
        configured={n8nConfigured()}
        missing={[missing.baseUrl ? 'N8N_BASE_URL' : '', missing.apiKey ? 'N8N_API_KEY' : ''].filter(Boolean).join(', ')}
      />
    </>
  );
}
