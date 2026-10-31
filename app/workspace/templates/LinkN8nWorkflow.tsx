'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { linkTemplateN8nWorkflow } from '@/lib/actions';
import { useToast } from '@/app/workspace/Shell';

type Workflow = { id: string; name: string };

export default function LinkN8nWorkflow({ templateId }: { templateId: string }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowId, setWorkflowId] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/n8n/workflows', { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; workflows?: Workflow[] };
        if (res.ok && data.ok) setWorkflows(data.workflows ?? []);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    const workflow = workflows.find((item) => item.id === workflowId);
    if (!workflow) return;
    setBusy(true);
    const result = await linkTemplateN8nWorkflow({ templateId, workflowId: workflow.id, workflowName: workflow.name });
    setBusy(false);
    toast(result.error ?? result.message ?? 'Saved.', result.ok ? 'ok' : 'err');
    if (result.ok) router.refresh();
  }

  return (
    <span className="template-workflow-link">
      <select className="textinput" value={workflowId} onChange={(event) => setWorkflowId(event.target.value)} aria-label="Choose n8n workflow">
        <option value="">Choose n8n workflow</option>
        {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
      </select>
      <button className="btn sq" onClick={save} disabled={busy || !workflowId}>{busy ? 'Linking…' : 'Link workflow'}</button>
    </span>
  );
}
