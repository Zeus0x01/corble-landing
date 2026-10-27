import { db } from '@/lib/db';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [leadAgg, projects, taskAgg, income, expenses, pendingAgg, settings] = await Promise.all([
    db.lead.groupBy({ by: ['status'], _count: { _all: true }, _sum: { estValue: true } }),
    db.project.groupBy({ by: ['status'], _count: { _all: true } }),
    db.task.groupBy({ by: ['status'], _count: { _all: true } }),
    db.financeRecord.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT', status: 'RECEIVED' } }),
    db.financeRecord.aggregate({ _sum: { amount: true }, where: { type: 'EXPENSE' } }),
    db.financeRecord.aggregate({ _sum: { amount: true }, where: { status: 'PENDING' } }),
    db.settings.upsert({ where: { id: 'global' }, update: {}, create: { id: 'global' } }),
  ]);
  const currency = settings.currency as 'EGP' | 'USD';

  const byLead = new Map(leadAgg.map((a) => [a.status, a]));
  const totalLeads = leadAgg.reduce((s, a) => s + a._count._all, 0) || 1;
  const pipelineValue = (['CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT'] as const)
    .reduce((s, k) => s + (byLead.get(k)?._sum.estValue ?? 0), 0);
  const won = byLead.get('WON')?._count._all ?? 0;
  const lost = byLead.get('LOST')?._count._all ?? 0;

  const byProject = new Map(projects.map((p) => [p.status, p._count._all]));
  const totalProjects = projects.reduce((s, p) => s + p._count._all, 0) || 1;
  const completed = byProject.get('COMPLETED') ?? 0;
  const delivered = completed + (byProject.get('DELIVERED') ?? 0);

  const byTask = new Map(taskAgg.map((t) => [t.status, t._count._all]));
  const totalTasks = taskAgg.reduce((s, t) => s + t._count._all, 0) || 1;
  const doneTasks = byTask.get('DONE') ?? 0;

  const money = (n: number) => formatMoney(n, currency);

  const cards: { label: string; value: string; sub: string; tone: string }[] = [
    { label: 'Sales pipeline', value: money(pipelineValue), sub: `${won} won · ${lost} lost · ${totalLeads - won - lost} in play`, tone: 'var(--purple)' },
    { label: 'Delivery', value: `${completed}/${totalProjects}`, sub: `${delivered} delivered+completed`, tone: 'var(--orange)' },
    { label: 'Task completion', value: `${Math.round((doneTasks / totalTasks) * 100)}%`, sub: `${doneTasks} of ${totalTasks} done`, tone: 'var(--green)' },
    { label: 'Revenue vs expenses', value: `${money(income._sum.amount ?? 0)}`, sub: `− ${money(expenses._sum.amount ?? 0)} expenses · pending ${money(pendingAgg._sum.amount ?? 0)}`, tone: 'var(--purple)' },
  ];

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Numbers that matter</h2>
          <div className="sub">Live aggregates. Export any dataset below.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn" href="/api/export/leads">⬇ Leads CSV</a>
          <a className="btn" href="/api/export/projects">⬇ Projects CSV</a>
          <a className="btn" href="/api/export/tasks">⬇ Tasks CSV</a>
          <a className="btn" href="/api/export/finance">⬇ Finance CSV</a>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
        {cards.map((c) => (
          <div className="kpi" key={c.label}>
            <div className="klabel">{c.label}</div>
            <div className="num" style={{ color: c.tone }}>{c.value}</div>
            <div className="kdelta">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid">
        <section className="card">
          <div className="panelhead"><h2>Sales pipeline — statuses</h2></div>
          <div className="bars">
            {leadAgg
              .sort((a, b) => b._count._all - a._count._all)
              .map((a) => (
                <div className="barrow" key={a.status}>
                  <span>{a.status.replace('_', ' ').toLowerCase()}</span>
                  <div className="track"><div className="pipelinefill" style={{ width: `${(a._count._all / totalLeads) * 100}%` }} /></div>
                  <span style={{ textAlign: 'right', color: 'var(--muted)' }}>{a._count._all} · {money(a._sum.estValue ?? 0)}</span>
                </div>
              ))}
          </div>
        </section>
        <section className="card">
          <div className="panelhead"><h2>Delivery & tasks</h2><span className="quiet">since start of {yearStart.getFullYear()}</span></div>
          <div className="bars">
            {(['PLANNING', 'IN_PROGRESS', 'REVIEW', 'DELIVERED', 'COMPLETED'] as const).map((s) => (
              <div className="barrow" key={s}>
                <span>{s.replace('_', ' ').toLowerCase()}</span>
                <div className="track"><div className="pipelinefill" style={{ width: `${((byProject.get(s) ?? 0) / totalProjects) * 100}%` }} /></div>
                <span style={{ textAlign: 'right', color: 'var(--muted)' }}>{byProject.get(s) ?? 0}</span>
              </div>
            ))}
            {(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const).map((s) => (
              <div className="barrow" key={`t-${s}`}>
                <span>task · {s.replace('_', ' ').toLowerCase()}</span>
                <div className="track"><div className="pipelinefill" style={{ width: `${((byTask.get(s) ?? 0) / totalTasks) * 100}%`, background: 'linear-gradient(90deg,#8b5cf6,#67e8f9)' }} /></div>
                <span style={{ textAlign: 'right', color: 'var(--muted)' }}>{byTask.get(s) ?? 0}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
