'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import type { ActionResult } from '@/lib/actions';

type Option = { id: string; label: string };

export default function SubmitDeliverableForm({
  tasks,
  phases,
  action,
}: {
  tasks: Option[];
  phases: Option[];
  action: (raw: unknown) => Promise<ActionResult>;
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [phaseId, setPhaseId] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!taskId && !phaseId) {
      toast('Choose a task or an automation phase.', 'err');
      return;
    }
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const result = await action({
      taskId,
      phaseId,
      title: String(form.get('title') ?? ''),
      externalUrl: String(form.get('externalUrl') ?? ''),
      body: String(form.get('body') ?? ''),
    });
    setBusy(false);
    toast(result.error ?? result.message ?? '', result.ok ? 'ok' : 'err');
    if (result.ok) {
      setOpen(false);
      setTaskId('');
      setPhaseId('');
      router.refresh();
    }
  }

  return (
    <>
      <button className="btn primary" type="button" disabled={!tasks.length && !phases.length} onClick={() => setOpen(true)}>
        ＋ Submit deliverable
      </button>
      {open ? (
        <div className="modalbg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form onSubmit={submit} className="card modal" role="dialog" aria-modal="true" aria-label="Submit deliverable">
            <div className="panelhead">
              <h2>Submit deliverable</h2>
              <button type="button" className="btn sq" onClick={() => setOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <div className="formgrid">
              <label className="field full">
                Task — deliver work done inside a task
                <select value={taskId} onChange={(e) => { setTaskId(e.target.value); setPhaseId(''); }} disabled={!tasks.length}>
                  <option value="">Not a task deliverable</option>
                  {tasks.map((task) => <option key={task.id} value={task.id}>{task.label}</option>)}
                </select>
              </label>
              <label className="field full">
                Automation phase — deliver a workflow phase
                <select value={phaseId} onChange={(e) => { setPhaseId(e.target.value); setTaskId(''); }} disabled={!phases.length}>
                  <option value="">Not an automation phase deliverable</option>
                  {phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.label}</option>)}
                </select>
              </label>
              <label className="field">
                Deliverable title
                <input name="title" required />
              </label>
              <label className="field">
                Link (Google Doc, repo, design file…)
                <input name="externalUrl" type="url" />
              </label>
              <label className="field full">
                Body — what you delivered
                <textarea name="body" required rows={4} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
