import { db } from '@/lib/db';
import { formatMoney, formatDate, labelize, toISODate } from '@/lib/format';
import { createLead, deleteLead, bulkDeleteLeads, convertLead, setLeadStatus, updateLead } from '@/lib/actions';
import InlineSelect from '@/components/InlineSelect';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';
import DataTable, { type DtRow } from '@/components/DataTable';
import LeadCsvImport from './LeadCsvImport';
import type { FieldSpec } from '@/lib/validators';
import LeadCodeCopy from './LeadCodeCopy';

export const dynamic = 'force-dynamic';

const SERVICES = ['AI Automation', 'Web Development', 'Cybersecurity', 'Website'];
const SOURCES = ['Website', 'Google Maps', 'Referral', 'Cold Outreach', 'LinkedIn'];
const STATUS = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'] as const;

function leadFields(owners: { id: string; name: string }[], edit?: { id: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; website: string | null; industry: string | null; city: string | null; country: string | null; notes: string | null; service: string; source: string; status: string; estValue: number; nextFollowUp: Date | null; ownerId: string | null }): FieldSpec[] {
  return [
    { label: 'Company / contact', name: 'name', required: true, value: edit?.name },
    { label: 'Contact person', name: 'contactPerson', value: edit?.contactPerson ?? '' },
    { label: 'Email', name: 'email', type: 'email', value: edit?.email ?? '' },
    { label: 'Phone', name: 'phone', value: edit?.phone ?? '' },
    { label: 'Website URL', name: 'website', value: edit?.website ?? '' },
    { label: 'Category / industry', name: 'industry', value: edit?.industry ?? '' },
    { label: 'City', name: 'city', value: edit?.city ?? '' },
    { label: 'Country', name: 'country', value: edit?.country ?? '' },
    { label: 'Service', name: 'service', type: 'select', options: SERVICES.map((s) => ({ value: s, label: s })), value: edit?.service },
    { label: 'Source', name: 'source', type: 'select', options: SOURCES.map((s) => ({ value: s, label: s })), value: edit?.source },
    { label: 'Status', name: 'status', type: 'select', options: STATUS.map((s) => ({ value: s, label: labelize(s) })), value: edit?.status },
    { label: 'Estimated value (EGP)', name: 'estValue', type: 'number', required: true, value: edit?.estValue },
    { label: 'Follow-up date', name: 'nextFollowUp', type: 'date', value: edit?.nextFollowUp ? toISODate(edit.nextFollowUp) : '' },
    { label: 'Owner', name: 'ownerId', type: 'select', options: [{ value: '', label: 'Unassigned' }, ...owners.map((o) => ({ value: o.id, label: o.name }))], value: edit?.ownerId ?? '' },
    { label: 'Notes', name: 'notes', type: 'text', full: true, value: edit?.notes ?? '' },
    { label: 'Record ID', name: 'id', type: 'text', required: true, full: true, value: edit?.id ?? 'auto' },
  ];
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; lead?: string }> }) {
  const { q, lead: selectedCode } = await searchParams;
  const query = (q ?? '').trim();

  const [leads, owners, leadLinkCounts] = await Promise.all([
    db.lead.findMany({
      where: query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { leadCode: { contains: query, mode: 'insensitive' } }, { contactPerson: { contains: query, mode: 'insensitive' } }, { service: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }] } : {},
      orderBy: [{ nextFollowUp: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      include: { owner: { select: { id: true, name: true } }, fileLinks: { select: { id: true } }, projects: { select: { id: true, name: true } }, tasks: { select: { id: true, title: true } }, _count: { select: { projects: true } } },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.fileLeadLink.groupBy({ by: ['leadId'], _count: { _all: true }, where: { kind: 'LEAD' } }),
  ]);
  const filesByLead = new Map(leadLinkCounts.map((g) => [g.leadId, g._count._all] as const));

  const rows: DtRow[] = leads.map((l) => ({
    id: l.id,
    vals: {
      name: l.name.toLowerCase(),
      leadCode: l.leadCode.toLowerCase(),
      source: l.source,
      status: l.status,
      value: l.estValue,
      followup: l.nextFollowUp ? l.nextFollowUp.toISOString() : null,
      owner: l.owner?.name ?? '',
    },
    cells: [
    <><a href={`/workspace/leads?lead=${encodeURIComponent(l.leadCode)}`} style={{ color: 'var(--purple)' }}>{l.leadCode}</a><LeadCodeCopy code={l.leadCode} /></>,
    <>
        <strong>{l.name}</strong>
        <div className="itemsub">{l.contactPerson || '—'} · {l.service}</div>
      </>,
    <>
      {l.email ? <div>{l.email}</div> : null}
      {l.phone ? <div className="itemsub">{l.phone}</div> : null}
      {!l.email && !l.phone ? '—' : null}
    </>,
    l.industry || l.service,
    [l.city, l.country].filter(Boolean).join(', ') || '—',
    l.website ? <a href={l.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)' }}>{l.website} ↗</a> : '—',
    l.source,
      <InlineSelect
        key="st"
        value={l.status}
        field="status"
        id={l.id}
        action={setLeadStatus}
        options={STATUS.map((s) => ({ value: s, label: labelize(s) }))}
        alwaysNotify
      />,
      formatMoney(l.estValue),
      formatDate(l.nextFollowUp),
      l.owner?.name ?? '—',
        <span key="acts" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {(filesByLead.get(l.id) ?? 0) > 0 ? (
          <a className="btn sq" href={`/workspace/files?tab=lead&id=${l.id}`} title={`Open ${(filesByLead.get(l.id) ?? 0)} linked file(s)`}>▤ {filesByLead.get(l.id)}</a>
        ) : null}
        {l.status === 'WON' && l._count.projects === 0 && (
          <ConfirmAction
            action={convertLead}
            payload={l.id}
            label="Convert to project"
            confirmText={`Create a project from “${l.name}”?`}
            className="btn sq"
            title="Convert to project"
          >→</ConfirmAction>
        )}
        <ModalForm
          title="Edit lead"
          trigger="✎"
          triggerClass="btn sq"
          action={updateLead}
          fields={leadFields(owners, { id: l.id, name: l.name, contactPerson: l.contactPerson, email: l.email, phone: l.phone, website: l.website, industry: l.industry, city: l.city, country: l.country, notes: l.notes, service: l.service, source: l.source, status: l.status, estValue: l.estValue, nextFollowUp: l.nextFollowUp, ownerId: l.ownerId })}
        />
        <ConfirmAction action={deleteLead} payload={l.id} label="Delete lead" />
      </span>,
    ],
  }));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Leads pipeline</h2>
          <div className="sub">Add, edit, schedule follow-ups; convert a Won lead into a real project.</div>
        </div>

        {selectedCode ? (() => {
          const selected = leads.find((l) => l.leadCode.toLowerCase() === selectedCode.toLowerCase());
          return selected ? (
            <div className="panel" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div><h3 style={{ margin: 0 }}>{selected.name}</h3><div className="sub">{selected.leadCode} · {selected.source}</div></div>
                <LeadCodeCopy code={selected.leadCode} />
              </div>
              <div className="sub" style={{ marginTop: 10 }}>
                {[selected.email, selected.phone, selected.website, selected.industry, selected.city, selected.country].filter(Boolean).join(' · ') || 'No additional contact information'}
              </div>
              <div className="sub" style={{ marginTop: 8 }}>
                Projects: {selected.projects.length ? selected.projects.map((p) => <a key={p.id} href="/workspace/projects" style={{ color: 'var(--purple)', marginLeft: 6 }}>{p.name}</a>) : 'none'} · Tasks: {selected.tasks.length ? selected.tasks.map((t) => <a key={t.id} href="/workspace/tasks" style={{ color: 'var(--purple)', marginLeft: 6 }}>{t.title}</a>) : 'none'}
              </div>
            </div>
          ) : null;
        })() : null}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <LeadCsvImport />
          <ModalForm
            title="Add lead"
            trigger="＋ Add lead"
            action={createLead}
            fields={leadFields(owners).filter((f) => f.name !== 'id')}
          />
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'leadCode', label: 'Lead ID' },
          { key: 'name', label: 'Company / Contact' },
          { label: 'Email / Phone' },
          { label: 'Category / Industry' },
          { label: 'City / Country' },
          { label: 'Website' },
          { key: 'source', label: 'Source' },
          { key: 'status', label: 'Status' },
          { key: 'value', label: 'Est. value' },
          { key: 'followup', label: 'Follow-up' },
          { key: 'owner', label: 'Owner' },
          { label: 'Actions' },
        ]}
        rows={rows}
        bulk={[{ label: 'Delete selected', action: bulkDeleteLeads, confirm: 'Delete all selected leads?', danger: true }]}
        empty={query ? 'No leads match your search.' : 'No leads yet — add your first one.'}
      />
    </>
  );
}
