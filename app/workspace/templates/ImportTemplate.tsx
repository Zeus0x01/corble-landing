'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { importTemplate } from '@/lib/actions';
import { useToast } from '@/app/workspace/Shell';

type Kind = 'AUTOMATION' | 'WEBSITE';
type Workflow = { id: string; name: string };

export default function ImportTemplate() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('AUTOMATION');
  const [url, setUrl] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!open || kind !== 'AUTOMATION' || workflows.length > 0) return;
    setLoadingWorkflows(true);
    fetch('/api/n8n/workflows', { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; workflows?: Workflow[]; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Could not load n8n workflows.');
        setWorkflows(data.workflows ?? []);
      })
      .catch((error: unknown) => toast(error instanceof Error ? error.message : 'Could not load n8n workflows.', 'err'))
      .finally(() => setLoadingWorkflows(false));
  }, [kind, open, toast, workflows.length]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workflow = workflows.find((item) => item.id === workflowId);
    if (kind === 'AUTOMATION' && !workflow) {
      toast('Choose an n8n workflow first.', 'err');
      return;
    }
    if (kind === 'WEBSITE' && !url.trim()) {
      toast('Enter a GitHub repository URL.', 'err');
      return;
    }
    setBusy(true);
    const result = await importTemplate({
      kind,
      ...(kind === 'WEBSITE' ? { url: url.trim() } : { workflowId: workflow?.id, workflowName: workflow?.name }),
    });
    setBusy(false);
    if (!result.ok) {
      toast(result.error ?? 'Import failed.', 'err');
      return;
    }
    setOpen(false);
    setUrl('');
    setWorkflowId('');
    toast(result.message ?? 'Template imported.');
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>⇪ Import</button>
      {open ? (
        <div className="modalbg" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <form onSubmit={submit} className="card modal" role="dialog" aria-modal="true" aria-label="Import template">
            <div className="panelhead">
              <h2>Import template</h2>
              <button type="button" className="btn sq" onClick={() => setOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <p className="modalhint">
              Websites are connected to GitHub. AI automations are connected to an existing workflow in the n8n Workflows tab.
            </p>
            <div className="formgrid">
              <label className="field full">
                Template type
                <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
                  <option value="AUTOMATION">AI Automation</option>
                  <option value="WEBSITE">Website</option>
                </select>
              </label>
              {kind === 'WEBSITE' ? (
                <label className="field full">
                  GitHub repository URL
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://github.com/owner/repository"
                  />
                </label>
              ) : (
                <label className="field full">
                  n8n workflow file
                  <select value={workflowId} onChange={(event) => setWorkflowId(event.target.value)} required>
                    <option value="">{loadingWorkflows ? 'Loading workflows…' : 'Choose an n8n workflow'}</option>
                    {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
                  </select>
                  {workflows.length === 0 && !loadingWorkflows ? <span className="fieldhint">Configure n8n or import a workflow in the n8n Workflows tab first.</span> : null}
                </label>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={busy || loadingWorkflows}>{busy ? 'Importing…' : 'Import template'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
