'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import { runVerification, addResearch, rejectIncoming, deleteIncoming, promoteToFinal } from '@/lib/actions';
import ModalForm from '@/components/ModalForm';
import ConfirmAction from '@/components/ConfirmAction';
import type { FieldSpec } from '@/lib/validators';

type Props = {
  leadId: string;
  company: string;
  processingStatus: string;
  verification: string;
  hasContact: boolean;
  owners: { id: string; name: string }[];
};

export default function IncomingActions(p: Props) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [research, setResearch] = useState('');
  const [researchUrl, setResearchUrl] = useState('');
  const [showResearch, setShowResearch] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    toast(res.error ?? res.message ?? (res.ok ? 'Done.' : 'Failed'), res.ok ? 'ok' : 'err');
    if (res.ok) router.refresh();
  }

  const promoted = p.processingStatus === 'PROMOTED';
  const rejected = p.processingStatus === 'REJECTED';

  const promoteFields: FieldSpec[] = [
    { label: 'Owner of the final lead', name: 'ownerId', type: 'select', full: true, options: [{ value: '', label: 'Me' }, ...p.owners.map((o) => ({ value: o.id, label: o.name }))], value: '' },
    { label: 'Estimated value (EGP)', name: 'estValue', type: 'number', value: 0 },
    { label: 'Override company name', name: 'overrideCompany', value: p.company },
  ];

  return (
    <span style={{ display: 'inline-flex', gap: 6, rowGap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {!promoted && !rejected ? (
        <>
          <button className="btn sq" disabled={busy} title="Check email syntax" aria-label="Verify email syntax" onClick={() => run(() => runVerification({ leadId: p.leadId, method: 'EMAIL_SYNTAX' }))}>@</button>
          <button className="btn sq" disabled={busy} title="Check domain DNS" aria-label="Verify domain" onClick={() => run(() => runVerification({ leadId: p.leadId, method: 'DOMAIN_DNS' }))}>DNS</button>
          <button className="btn sq" disabled={busy} title="Fetch website (8s timeout)" aria-label="Verify website" onClick={() => run(() => runVerification({ leadId: p.leadId, method: 'WEBSITE_FETCH' }))}>☰</button>
          <button className="btn sq" disabled={busy} title="Record manual review" aria-label="Record manual review" onClick={() => run(() => runVerification({ leadId: p.leadId, method: 'MANUAL_REVIEW' }))}>👁</button>
          <button className="btn sq" disabled={busy} onClick={() => setShowResearch((v) => !v)} title="Add research note" aria-label="Add research note">✎</button>
          <button className="btn sq" disabled={busy} onClick={() => run(() => rejectIncoming({ incomingId: p.leadId }))} title="Reject lead" aria-label="Reject lead">✕</button>
          <ModalForm title={`Promote "${p.company}" to Final Leads`} trigger="⤒ Promote" triggerClass="btn" action={promoteToFinal} fields={promoteFields} hidden={{ incomingId: p.leadId }} />
        </>
      ) : null}
      {rejected ? (
        <>
          <span className="pill">rejected</span>
          <button className="btn" disabled={busy} onClick={() => run(() => rejectIncoming({ incomingId: p.leadId, restore: true }))}>Restore</button>
        </>
      ) : null}
      {!promoted ? (
        <ConfirmAction action={deleteIncoming} payload={p.leadId} label={`Delete ${p.company}`} confirmText={`Permanently delete incoming lead "${p.company}"? This cannot be undone.`} className="btn sq danger">🗑</ConfirmAction>
      ) : null}
      {promoted ? <span className="pill" style={{ color: 'var(--green)' }}>promoted ✓</span> : null}

      {showResearch ? (
        <span style={{ display: 'inline-flex', gap: 6, width: '100%', flexDirection: 'column' }}>
          <input className="textinput" autoFocus placeholder="Research note — verification learning, outreach result, why it looks fake/solid…" value={research} onChange={(e) => setResearch(e.target.value)} />
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <input className="textinput" style={{ flex: 1 }} placeholder="Source URL (optional)" value={researchUrl} onChange={(e) => setResearchUrl(e.target.value)} />
            <button
              className="btn"
              disabled={busy || !research.trim()}
              onClick={async () => {
                setShowResearch(false);
                await run(() => addResearch({ leadId: p.leadId, body: research, sourceUrl: researchUrl || undefined }));
                setResearch('');
                setResearchUrl('');
              }}
            >
              Save note
            </button>
          </span>
        </span>
      ) : null}
      {!p.hasContact && !promoted ? <span className="itemsub">no email/phone/website — promote disabled until verified</span> : null}
    </span>
  );
}
