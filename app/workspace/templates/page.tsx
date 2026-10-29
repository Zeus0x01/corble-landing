import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { labelize, formatDate } from '@/lib/format';
import { useTemplate, importTemplate } from '@/lib/actions';
import ModalForm from '@/components/ModalForm';
import type { FieldSpec } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const KINDS = ['AUTOMATION', 'WEBSITE'] as const;

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const session = await auth();
  const role = (session?.user?.role ?? 'MEMBER') as string;
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const kind = KINDS.includes(sp.kind as never) ? (sp.kind as (typeof KINDS)[number]) : null;

  const filters: Prisma.TemplateWhereInput[] = [];
  if (query) filters.push({ OR: [{ name: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }] });
  if (kind) filters.push({ kind });

  const templates = await db.template.findMany({
    where: filters.length ? { AND: filters } : {},
    orderBy: { createdAt: 'asc' },
  });

  const importFields: FieldSpec[] = [
    { label: 'Category', name: 'kind', type: 'select', required: true, options: KINDS.map((k) => ({ value: k, label: labelize(k) })) },
    { label: 'GitHub repo URL (public)', name: 'url', required: true, full: true, value: 'https://github.com/' },
  ];

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Playbook</h2>
          <div className="sub">
            Two categories: Automations and Websites. “Use template” creates the project plus starter tasks. Showing {templates.length} templates.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {kind && <a className="btn" href="/workspace/templates">Clear filter</a>}
          <a className="btn" href="/workspace/templates?kind=AUTOMATION">Automations</a>
          <a className="btn" href="/workspace/templates?kind=WEBSITE">Websites</a>
          {role === 'ADMIN' ? <ModalForm title="Import template from GitHub" trigger="⇪ Import" action={importTemplate} fields={importFields} /> : null}
        </div>
      </div>

      <div className="grid">
        {templates.length === 0 ? (
          <div className="card wide"><div className="empty" style={{ textAlign: 'center', color: 'var(--muted)' }}>No templates{kind ? ` in ${labelize(kind)}` : ' match'}.</div></div>
        ) : (
          templates.map((t) => (
            <section className="card" key={t.id}>
              <div className="panelhead">
                <h2>{t.name}</h2>
                <span className="pill">{t.kind === 'WEBSITE' ? '🌐 website' : '⚙︎ automation'} · {t.steps.length} steps</span>
              </div>
              <p style={{ color: 'var(--muted)', margin: '0 0 12px', fontSize: 13 }}>{t.description}</p>
              <ol style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--text)', fontSize: 13, display: 'grid', gap: 6 }}>
                {t.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
              {t.repoUrl ? (
                <div className="itemsub" style={{ marginBottom: 8 }}>
                  <a href={t.repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)' }}>source repo ↗</a>
                  {t.framework ? <> · framework: {t.framework}</> : null}
                  {t.envVarNames.length > 0 ? <> · env: {t.envVarNames.join(', ')}</> : null}
                </div>
              ) : null}
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
              <div className="itemsub" style={{ marginTop: 10 }}>Created {formatDate(t.createdAt)}{t.source ? ` · from ${t.source}` : ''}{t.version ? ` · v${t.version}` : ''}</div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
