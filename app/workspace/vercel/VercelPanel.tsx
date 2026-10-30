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
  repo: string | null;
  latestCommit: { sha: string | null; message: string | null; url: string | null } | null;
  previewDeploy: { status: string; environment: string; url: string | null; errorSummary: string | null; commitSha?: string | null; at: string } | null;
  productionDeploy: { status: string; environment: string; url: string | null; errorSummary: string | null; commitSha?: string | null; at: string } | null;
};

function DeployCell({ deployment, openLink }: { deployment: ProjectRow['previewDeploy']; openLink: boolean }) {
  return (
    <div>
      {deployment ? (
        <>
          <div className="pill" style={deployment.status === 'LIVE' ? { color: 'var(--green)' } : deployment.status === 'FAILED' ? { color: 'var(--acid)' } : undefined}>
            {deployment.status}
          </div>
          {openLink && deployment.url ? <div className="itemsub"><a href={deployment.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)' }}>open ↗</a></div> : null}
          <div className="itemsub">{new Date(deployment.at).toLocaleString()}</div>
          {deployment.errorSummary ? <div className="itemsub">{deployment.errorSummary}</div> : null}
        </>
      ) : (
        <div className="itemsub">no deployment yet</div>
      )}
    </div>
  );
}

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
            <thead><tr><th>Project</th><th>Repo</th><th>Latest commit</th><th>Preview</th><th>Production</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.repo ?? '—'}</td>
                  <td>{r.latestCommit?.message ?? '—'}{r.latestCommit?.url ? <> · <a href={r.latestCommit.url} target="_blank" rel="noopener noreferrer">view</a></> : null}</td>
                  <td><DeployCell deployment={r.previewDeploy} openLink /></td>
                  <td><DeployCell deployment={r.productionDeploy} openLink /></td>
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
        <thead><tr><th>Project</th><th>Repo</th><th>Latest commit</th><th>Preview</th><th>Production</th><th>Deploy</th><th>Configure</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const configFields: FieldSpec[] = [
              { label: 'Vercel project ID (from Vercel dashboard settings)', name: 'vercelProjectId', required: true, value: r.vercelProjectId ?? '' },
              { label: 'Team ID (optional, for team projects)', name: 'vercelTeamId', value: '' },
            ];
            return (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.repo ?? '—'}</td>
                <td>{r.latestCommit?.message ?? '—'}{r.latestCommit?.url ? <> · <a href={r.latestCommit.url} target="_blank" rel="noopener noreferrer">view</a></> : null}</td>
                <td><DeployCell deployment={r.previewDeploy} openLink /></td>
                <td><DeployCell deployment={r.productionDeploy} openLink /></td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn" disabled={busy !== null || !r.connId || !configured} onClick={() => fire(r.id, false)} title="Fire preview deployment">Refresh preview</button>
                    <button className="btn" disabled={busy !== null || !r.connId || !configured} onClick={() => fire(r.id, true)} title="Fire production deployment (select Vercel production target)">Deploy to production</button>
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
