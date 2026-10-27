import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { useTemplate } from '@/lib/actions';
import ModalForm from '@/components/ModalForm';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const templates = await db.template.findMany({
    where: query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }] } : {},
    orderBy: { createdAt: 'asc' },
  });

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Playbook</h2>
          <div className="sub">“Use template” creates the project plus its starter tasks.</div>
        </div>
      </div>

      <div className="grid">
        {templates.length === 0 ? (
          <div className="card wide"><div className="empty" style={{ textAlign: 'center', color: 'var(--muted)' }}>No templates match.</div></div>
        ) : (
          templates.map((t) => (
            <section className="card" key={t.id}>
              <div className="panelhead">
                <h2>{t.name}</h2>
                <span className="pill">{t.steps.length} steps</span>
              </div>
              <p style={{ color: 'var(--muted)', margin: '0 0 12px', fontSize: 13 }}>{t.description}</p>
              <ol style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--text)', fontSize: 13, display: 'grid', gap: 6 }}>
                {t.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
              <ModalForm
                title={`Use template — ${t.name}`}
                trigger="Use template →"
                action={useTemplate}
                hidden={{ templateId: t.id }}
                fields={[
                  { label: 'Project name', name: 'name', required: true, full: true, placeholder: `${t.name} · <client>` },
                  { label: 'Client name', name: 'clientName', required: true },
                  { label: 'Budget (EGP)', name: 'budget', type: 'number', required: true },
                  { label: 'Due date', name: 'dueDate', type: 'date' },
                ]}
              />
              <div className="itemsub" style={{ marginTop: 10 }}>Created {formatDate(t.createdAt)}</div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
