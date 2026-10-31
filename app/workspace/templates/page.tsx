import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { labelize, formatDate } from '@/lib/format';
import { useTemplate } from '@/lib/actions';
import ModalForm from '@/components/ModalForm';
import LinkN8nWorkflow from './LinkN8nWorkflow';
import ImportTemplate from './ImportTemplate';

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

  const automationCount = templates.filter((template) => template.kind === 'AUTOMATION').length;
  const websiteCount = templates.filter((template) => template.kind === 'WEBSITE').length;

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Playbook</h2>
          <div className="sub">Reusable starting points for delivery. “Use template” creates a project plus starter tasks.</div>
          <div className="template-stats" aria-label="Template counts">
            <span><strong>{templates.length}</strong> total</span>
            <span><strong>{automationCount}</strong> automations</span>
            <span><strong>{websiteCount}</strong> websites</span>
          </div>
        </div>
        <div className="template-actions">
          {kind && <a className="btn" href="/workspace/templates">Clear filter</a>}
          <a className="btn" href="/workspace/templates?kind=AUTOMATION">Automations</a>
          <a className="btn" href="/workspace/templates?kind=WEBSITE">Websites</a>
          {role === 'ADMIN' ? <ImportTemplate /> : null}
        </div>
      </div>

      <div className="grid">
        {templates.length === 0 ? (
          <div className="card wide"><div className="empty" style={{ textAlign: 'center', color: 'var(--muted)' }}>No templates{kind ? ` in ${labelize(kind)}` : ' match'}.</div></div>
        ) : (
          templates.map((t) => (
            <section className="card template-card" key={t.id}>
              <div className="panelhead">
                <div>
                  <div className="template-eyebrow">{t.kind === 'WEBSITE' ? 'Website playbook' : 'Automation playbook'}</div>
                  <h2>{t.name}</h2>
                </div>
                <span className={`pill ${t.kind.toLowerCase()}`}>{t.kind === 'WEBSITE' ? '🌐 website' : '⚙︎ automation'} · {t.steps.length} steps</span>
              </div>
              <p style={{ color: 'var(--muted)', margin: '0 0 12px', fontSize: 13 }}>{t.description}</p>
              <ol style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--text)', fontSize: 13, display: 'grid', gap: 6 }}>
                {t.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
              {t.kind === 'WEBSITE' && t.repoUrl ? (
                <div className="template-meta">
                  <span>GitHub source</span>
                  <a href={t.repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)' }}>{t.repoUrl} ↗</a>
                  {t.framework ? <span>Framework: {t.framework}</span> : null}
                  {t.envVarNames.length > 0 ? <span>Env: {t.envVarNames.join(', ')}</span> : null}
                </div>
              ) : null}
              {t.kind === 'AUTOMATION' ? (
                t.n8nWorkflowId ? (
                  <div className="template-meta">
                    <span>n8n workflow</span>
                    <a href={`/workspace/n8n?workflow=${encodeURIComponent(t.n8nWorkflowId)}`} style={{ color: 'var(--purple)' }}>{t.n8nWorkflowName ?? t.n8nWorkflowId} ↗</a>
                  </div>
                ) : role === 'ADMIN' ? (
                  <div style={{ marginBottom: 10 }}><LinkN8nWorkflow templateId={t.id} /></div>
                ) : null
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
