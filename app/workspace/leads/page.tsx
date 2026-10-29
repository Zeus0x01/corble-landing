import { db } from '@/lib/db';
import { formatMoney, formatDate, labelize, toISODate } from '@/lib/format';
import { createLead, deleteLead, bulkDeleteLeads, convertLead, setLeadStatus, updateLead } from '@/lib/actions';
import InlineSelect from '@/components/InlineSelect';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';
import DataTable, { type DtRow } from '@/components/DataTable';
import type { FieldSpec } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const SERVICES = ['AI Automation', 'Web Development', 'Cybersecurity', 'Website'];
const SOURCES = ['Website', 'Google Maps', 'Referral', 'Cold Outreach', 'LinkedIn'];
const STATUS = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'] as const;

function leadFields(owners: { id: string; name: string }[], edit?: { id: string; name: string; contactPerson: string | null; service: string; source: string; status: string; estValue: number; nextFollowUp: Date | null; ownerId: string | null }): FieldSpec[] {
  return [
    { label: 'Company / contact', name: 'name', required: true, value: edit?.name },
    { label: 'Contact person', name: 'contactPerson', value: edit?.contactPerson ?? '' },
    { label: 'Service', name: 'service', type: 'select', options: SERVICES.map((s) => ({ value: s, label: s })), value: edit?.service },
    { label: 'Source', name: 'source', type: 'select', options: SOURCES.map((s) => ({ value: s, label: s })), value: edit?.source },
    { label: 'Status', name: 'status', type: 'select', options: STATUS.map((s) => ({ value: s, label: labelize(s) })), value: edit?.status },
    { label: 'Estimated value (EGP)', name: 'estValue', type: 'number', required: true, value: edit?.estValue },
    { label: 'Follow-up date', name: 'nextFollowUp', type: 'date', value: edit?.nextFollowUp ? toISODate(edit.nextFollowUp) : '' },
    { label: 'Owner', name: 'ownerId', type: 'select', options: [{ value: '', label: 'Unassigned' }, ...owners.map((o) => ({ value: o.id, label: o.name }))], value: edit?.ownerId ?? '' },
    { label: 'Record ID', name: 'id', type: 'text', required: true, full: true, value: edit?.id ?? 'auto' },
  ];
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const [leads, owners, leadLinkCounts] = await Promise.all([
    db.lead.findMany({
      where: query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { contactPerson: { contains: query, mode: 'insensitive' } }, { service: { contains: query, mode: 'insensitive' } }] } : {},
      orderBy: [{ nextFollowUp: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      include: { owner: { select: { id: true, name: true } }, fileLinks: { select: { id: true } }, _count: { select: { projects: true } } },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.fileLeadLink.groupBy({ by: ['leadId'], _count: { _all: true }, where: { kind: 'LEAD' } }),
  ]);
  const filesByLead = new Map(leadLinkCounts.map((g) => [g.leadId, g._count._all] as const));

  const rows: DtRow[] = leads.map((l) => ({
    id: l.id,
    vals: {
      name: l.name.toLowerCase(),
      source: l.source,
      status: l.status,
      value: l.estValue,
      followup: l.nextFollowUp ? l.nextFollowUp.toISOString() : null,
      owner: l.owner?.name ?? '',
    },
    cells: [
      <>
        <strong>{l.name}</strong>
        <div className="itemsub">{l.contactPerson || '—'} · {l.service}</div>
      </>,
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
          fields={leadFields(owners, { id: l.id, name: l.name, contactPerson: l.contactPerson, service: l.service, source: l.source, status: l.status, estValue: l.estValue, nextFollowUp: l.nextFollowUp, ownerId: l.ownerId })}
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
        <ModalForm
          title="Add lead"
          trigger="＋ Add lead"
          action={createLead}
          fields={leadFields(owners).filter((f) => f.name !== 'id')}
        />
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Company / Contact' },
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
