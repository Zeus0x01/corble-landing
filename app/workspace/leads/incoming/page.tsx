import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { labelize, formatDT } from '@/lib/format';
import { bulkRejectIncoming } from '@/lib/actions';
import IncomingActions from './IncomingActions';
import CsvImport from './CsvImport';
import DataTable, { type DtRow } from '@/components/DataTable';

export const dynamic = 'force-dynamic';

export default async function IncomingLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; verification?: string; q?: string }> }) {
  const session = await auth();
  const u = session?.user ? await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }) : null;
  const role = u?.role ?? 'MEMBER';
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const status = ['NEW', 'UNDER_REVIEW', 'REJECTED', 'PROMOTED', 'DUPLICATE'].includes(sp.status ?? '') ? (sp.status as string) : null;
  const verification = ['UNVERIFIED', 'SYNTAX_VALIDATED', 'DOMAIN_CHECKED', 'WEBSITE_REACHABLE', 'CONTACT_VERIFIED', 'MANUALLY_REVIEWED', 'INVALID', 'VERIFICATION_FAILED'].includes(sp.verification ?? '') ? (sp.verification as string) : null;

  const filters: Prisma.IncomingLeadWhereInput[] = [];
  if (query) filters.push({ OR: [{ company: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }, { domain: { contains: query, mode: 'insensitive' } }] });
  if (status) filters.push({ processingStatus: status as never });
  if (verification) filters.push({ verification: verification as never });

  const [leads, users, batches] = await Promise.all([
    db.incomingLead.findMany({
      where: filters.length ? { AND: filters } : {},
      orderBy: [{ receivedAt: 'desc' }],
      take: 200,
      include: {
        reviewedBy: { select: { name: true } },
        finalLead: { select: { id: true, name: true } },
        researchUpdates: { orderBy: { createdAt: 'desc' }, take: 3, include: { author: { select: { name: true } } } },
        verificationChecks: { orderBy: { createdAt: 'desc' }, take: 4, include: { checkedBy: { select: { name: true } } } },
        importBatch: { select: { filename: true } },
      },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.leadImportBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
  ]);

  const counts = await Promise.all(
    (['NEW', 'UNDER_REVIEW', 'REJECTED', 'PROMOTED'] as const).map(async (s) => ({
      s,
      n: await db.incomingLead.count({ where: { processingStatus: s } }),
    }))
  );

  const rows: DtRow[] = leads.map((l) => ({
    id: l.id,
    vals: {
      company: l.company.toLowerCase(),
      contact: (l.email ?? l.phone ?? l.contactPerson ?? '').toLowerCase(),
      received: l.receivedAt.toISOString(),
      source: l.source,
      verification: l.verification,
      status: l.processingStatus,
    },
    cells: [
      <>
        <strong>{l.company}</strong>
        {l.industry ? <div className="itemsub">{l.industry}</div> : null}
        {l.website ? <div className="itemsub"><a href={l.website.startsWith('http') ? l.website : `https://${l.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)' }}>{l.website} ↗</a></div> : null}
        <RawPayload raw={l.rawPayload} />
      </>,
      <>
        {l.email ? <div>{l.email}</div> : null}
        {l.phone ? <div>{l.phone}</div> : null}
        {l.contactPerson ? <div className="itemsub">{l.contactPerson}</div> : null}
        {!l.email && !l.phone ? <span className="itemsub">no direct contact</span> : null}
      </>,
      <>
        <div>{l.source}</div>
        <div className="itemsub">{formatDT(l.receivedAt)}</div>
        {l.batchId ? <div className="itemsub">batch {l.importBatch?.filename ?? l.batchId.slice(0, 8)}</div> : null}
      </>,
      <span key="v" className="pill" style={l.verification === 'INVALID' || l.verification === 'VERIFICATION_FAILED' ? { color: 'var(--acid)' } : l.verification !== 'UNVERIFIED' ? { color: 'var(--green)' } : undefined}>{labelize(l.verification)}</span>,
      <>
        {l.researchUpdates.map((r) => (
          <div key={r.id} className="itemsub">✎ {r.author?.name ?? 'member'}: {r.body}</div>
        ))}
        {l.verificationChecks.map((c) => (
          <div key={c.id} className="itemsub">{c.method}: {labelize(c.result)}{c.detail ? ` — ${c.detail}` : ''}</div>
        ))}
        {l.researchUpdates.length === 0 && l.verificationChecks.length === 0 ? <span className="itemsub">nothing yet</span> : null}
      </>,
      <>
        <span key="ps" className="pill" style={l.processingStatus === 'PROMOTED' ? { color: 'var(--green)' } : l.processingStatus === 'REJECTED' ? { color: 'var(--acid)' } : undefined}>{labelize(l.processingStatus)}</span>
        {l.finalLead ? <div className="itemsub"><a href="/workspace/leads" style={{ color: 'var(--purple)' }}>→ {l.finalLead.name}</a></div> : null}
      </>,
      <span key="acts" style={{ maxWidth: 420, display: 'inline-block' }}>
        <IncomingActions
          leadId={l.id}
          company={l.company}
          processingStatus={l.processingStatus}
          verification={l.verification}
          hasContact={Boolean(l.email || l.phone || l.website)}
          owners={users}
        />
      </span>,
    ],
  }));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Incoming leads</h2>
          <div className="sub">
            {counts.map((c) => `${labelize(c.s)}: ${c.n}`).join(' · ')} · filtered view: {leads.length}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {role === 'ADMIN' ? <CsvImport /> : null}
        </div>
      </div>

      {batches.length > 0 ? (
        <div className="tablewrap" style={{ marginBottom: 12 }}>
          <table className="table">
            <thead><tr><th>Import batches</th><th>Rows</th><th>Created</th><th>Duplicates</th><th>Skipped</th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.filename ?? b.id}</td>
                  <td>{b.totalRows} total · {b.validRows} valid</td>
                  <td>{formatDT(b.createdAt)}</td>
                  <td>{b.duplicateRows}</td>
                  <td>{b.invalidRows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <DataTable
        columns={[
          { key: 'company', label: 'Company' },
          { key: 'contact', label: 'Contact' },
          { key: 'received', label: 'Source / received' },
          { key: 'verification', label: 'Verification' },
          { label: 'Research & checks' },
          { key: 'status', label: 'Status' },
          { label: 'Actions' },
        ]}
        rows={rows}
        bulk={[{ label: 'Reject selected', action: bulkRejectIncoming, confirm: 'Mark all selected incoming leads as rejected? (promoted ones are skipped)', danger: true }]}
        empty="No incoming leads match — ingest via n8n webhook or CSV import."
      />

      <div className="sub" style={{ padding: '8px 2px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        Status filters:
        {['NEW', 'UNDER_REVIEW', 'REJECTED', 'PROMOTED', 'DUPLICATE'].map((s) => (
          <a key={s} href={`/workspace/leads/incoming?status=${s}`} style={{ color: 'var(--purple)' }}>{labelize(s)}</a>
        ))}
        · Verification filters:
        {['UNVERIFIED', 'INVALID', 'MANUALLY_REVIEWED'].map((s) => (
          <a key={s} href={`/workspace/leads/incoming?verification=${s}`} style={{ color: 'var(--purple)' }}>{labelize(s)}</a>
        ))}
      </div>
    </>
  );
}

function RawPayload({ raw }: { raw: unknown }) {
  const text = JSON.stringify(raw);
  return <div className="itemsub" title={text} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>raw: {text.slice(0, 120)}</div>;
}
