import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { formatMoney, formatDate, labelize, toISODate } from '@/lib/format';
import { createFinance, deleteFinance, updateFinance } from '@/lib/actions';
import ConfirmAction from '@/components/ConfirmAction';
import ModalForm from '@/components/ModalForm';
import type { FieldSpec } from '@/lib/validators';

export const dynamic = 'force-dynamic';

function financeFields(
  projects: { id: string; name: string }[],
  currency: 'EGP' | 'USD',
  edit?: { id: string; type: string; description: string; amount: number; status: string; date: Date; projectId: string | null },
): FieldSpec[] {
  return [
    { label: 'Type', name: 'type', type: 'select', options: ['INVOICE', 'PAYMENT', 'EXPENSE'].map((t) => ({ value: t, label: labelize(t) })), value: edit?.type ?? 'INVOICE' },
    { label: 'Description', name: 'description', required: true, value: edit?.description },
    { label: 'Status', name: 'status', type: 'select', options: ['PENDING', 'RECEIVED', 'PAID', 'OVERDUE'].map((s) => ({ value: s, label: labelize(s) })), value: edit?.status ?? 'PENDING' },
    { label: `Amount (${currency})`, name: 'amount', type: 'number', required: true, value: edit?.amount },
    { label: 'Date', name: 'date', type: 'date', required: true, value: edit ? toISODate(edit.date) : toISODate(new Date()) },
    { label: 'Project', name: 'projectId', type: 'select', options: [{ value: '', label: 'None' }, ...projects.map((p) => ({ value: p.id, label: p.name }))], value: edit?.projectId ?? '' },
    { label: 'Record ID', name: 'id', type: 'text', required: true, full: true, value: edit?.id ?? 'auto' },
  ];
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const [records, projects, settings] = await Promise.all([
    db.financeRecord.findMany({
      where: query ? { description: { contains: query, mode: 'insensitive' } } : {},
      orderBy: { date: 'desc' },
      include: { project: { select: { name: true } } },
    }),
    db.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.settings.upsert({ where: { id: 'global' }, update: {}, create: { id: 'global' } }),
  ]);
  const currency = settings.currency as 'EGP' | 'USD';

  const received = records.filter((r) => r.type === 'PAYMENT' && r.status === 'RECEIVED').reduce((s, r) => s + r.amount, 0);
  const pending = records.filter((r) => r.type !== 'EXPENSE' && (r.status === 'PENDING' || r.status === 'OVERDUE')).reduce((s, r) => s + r.amount, 0);
  const expenses = records.filter((r) => r.type === 'EXPENSE').reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Money in / money out</h2>
          <div className="sub">
            <span className="up" style={{ marginRight: 14 }}>Received {formatMoney(received, currency)}</span>
            <span style={{ marginRight: 14, color: 'var(--orange)' }}>Pending {formatMoney(pending, currency)}</span>
            <span className="down">Expenses {formatMoney(expenses, currency)}</span>
          </div>
        </div>
        {isAdmin ? <ModalForm
          title="Add finance record"
          trigger="＋ Add record"
          action={createFinance}
          fields={financeFields(projects, currency).filter((f) => f.name !== 'id')}
        /> : null}
      </div>

      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr><th>Record</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Project</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={7} className="empty">{query ? 'No records match your search.' : 'No finance records yet.'}</td></tr>
            ) : (
              records.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.description}</strong></td>
                  <td><span className={`pill ${f.type.toLowerCase()}`}>{labelize(f.type)}</span></td>
                  <td style={{ fontWeight: 700 }}>{f.type === 'EXPENSE' ? '−' : '+'} {formatMoney(f.amount, currency)}</td>
                  <td><span className={`pill ${f.status.toLowerCase()}`}>{labelize(f.status)}</span></td>
                  <td>{formatDate(f.date)}</td>
                  <td><div className="itemsub">{f.project?.name ?? '—'}</div></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {isAdmin ? <ModalForm
                      title="Edit record"
                      trigger="✎"
                      triggerClass="btn sq"
                      action={updateFinance}
                      fields={financeFields(projects, currency, { id: f.id, type: f.type, description: f.description, amount: f.amount, status: f.status, date: f.date, projectId: f.projectId })}
                    /> : null}
                    {isAdmin ? <ConfirmAction action={deleteFinance} payload={f.id} label="Delete record" /> : null}
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
