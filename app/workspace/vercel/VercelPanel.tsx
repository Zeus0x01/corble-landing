'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { configureDeploy, deployProject } from '@/lib/actions';
import ModalForm from '@/components/ModalForm';
import type { FieldSpec } from '@/lib/validators';

type ProjectRow = {
  id: string;
  name: string;
  connId: string | null;
  vercelProjectId: string | null;
  lastDeploy: { status: string; environment: string; url: string | null; errorSummary: string | null; at: string } | null;
};

export default function VercelPanel({ rows, admin, configured }: { rows: ProjectRow[]; admin: boolean; configured: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function fire(projectId: string, production: boolean) {
    setBusy(projectId + (production ? ':p' : ''));
    const res = await deployProject({ projectId, production, ...(production ? { confirm: true } : {}) });
    setBusy(null);
    toast(res.error ?? res.message ?? 'Deploy queued.', res.ok ? 'ok' : 'err');
    if (res.ok) router.refresh();
  }

  if (!admin) {
    return (
      <>
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th>Project</th><th>Vercel project</th><th>Last deploy</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.vercelProjectId ?? '—'}</td>
                  <td>
                    {r.lastDeploy ? (
                      <>
                        <div className="pill">{r.lastDeploy.status}</div>
                        {r.lastDeploy.url ? <div className="itemsub"><a href={r.lastDeploy.url} style={{ color: 'var(--purple)' }}>open ↗</a></div> : null}
                      </>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ padding: '8px 2px' }}>Deploys are admin-triggered.</div>
      </>
    );
  }

  return (
    <>
      <div className="tablewrap">
        <table className="table">
          <thead><tr><th>Project</th><th>Vercel project</th><th>Last deploy</th><th>Deploy</th><th>Configure</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const configFields: FieldSpec[] = [
                { label: 'Vercel project ID (from Vercel dashboard settings)', name: 'vercelProjectId', required: true, value: r.vercelProjectId ?? '' },
                { label: 'Team ID (optional, for team projects)', name: 'vercelTeamId', value: '' },
              ];
              return (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.vercelProjectId ?? '—'}</td>
                  <td>
                    {r.lastDeploy ? (
                      <>
                        <div className="pill" style={r.lastDeploy.status === 'LIVE' ? { color: 'var(--green)' } : r.lastDeploy.status === 'FAILED' ? { color: 'var(--acid)' } : undefined}>
                          {r.lastDeploy.environment}: {r.lastDeploy.status}
                        </div>
                        {r.lastDeploy.url ? <div className="itemsub"><a href={r.lastDeploy.url} style={{ color: 'var(--purple)' }}>open ↗</a></div> : null}
                        {r.lastDeploy.errorSummary ? <div className="itemsub">{r.lastDeploy.errorSummary}</div> : null}
                      </>
                    ) : '—'}
                  </td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn" disabled={busy !== null || !r.connId || !configured} onClick={() => fire(r.id, false)} title="Fire preview deployment">Preview deploy</button>
                    <button className="btn" disabled={busy !== null || !r.connId || !configured} onClick={() => fire(r.id, true)} title="Fire production deployment (select Vercel production target)">Production deploy</button>
                  </td>
                  <td>
                    <ModalForm title={`Configure Vercel — ${r.name}`} trigger="⚙︎" triggerClass="btn sq" action={configureDeploy} fields={configFields} hidden={{ projectId: r.id }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!configured ? <div className="sub" style={{ padding: '8px 2px' }}>VERCEL_TOKEN not set in server env — add a Vercel token with Deployment create+read scope.</div> : null}
    </>
  );
}
