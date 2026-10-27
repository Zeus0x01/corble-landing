import { db } from '@/lib/db';
import { formatMoney, formatDate, labelize, toISODate } from '@/lib/format';
import { createLead, deleteLead, convertLead, setLeadStatus, updateLead } from '@/lib/actions';
import InlineSelect from '@/components/InlineSelect';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';
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

  const leads = await db.lead.findMany({
    where: query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { contactPerson: { contains: query, mode: 'insensitive' } }, { service: { contains: query, mode: 'insensitive' } }] } : {},
    orderBy: [{ nextFollowUp: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    include: { owner: { select: { id: true, name: true } }, _count: { select: { projects: true } } },
  });
  const owners = await db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });

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

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Company / Contact</th><th>Source</th><th>Status</th><th>Est. value</th><th>Follow-up</th><th>Owner</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr><td colSpan={7} className="empty">{query ? 'No leads match your search.' : 'No leads yet — add your first one.'}</td></tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.name}</strong>
                    <div className="itemsub">{l.contactPerson || '—'} · {l.service}</div>
                  </td>
                  <td>{l.source}</td>
                  <td>
                    <InlineSelect
                      value={l.status}
                      field="status"
                      id={l.id}
                      action={setLeadStatus}
                      options={STATUS.map((s) => ({ value: s, label: labelize(s) }))}
                      alwaysNotify
                    />
                  </td>
                  <td>{formatMoney(l.estValue)}</td>
                  <td>{formatDate(l.nextFollowUp)}</td>
                  <td>{l.owner?.name ?? '—'}</td>
                  <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

