import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatMoney, labelize, progressTone, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

type MonthRow = { month: number; income: number; expenses: number };

export default async function OverviewPage() {
  const session = await auth();
  const role = session?.user.role ?? 'MEMBER';
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [leadAgg, activeProjects, taskByPriority, paymentReceived, expensesPaid, upcoming, activeProjectList, activity, months, userCount, incomingNew, incomingReview, handoversPending, deliverablesReview, deliverablesChanges, automationsActive, unreadAlerts] =
    await Promise.all([
      db.lead.groupBy({ by: ['status'], _count: { _all: true }, _sum: { estValue: true } }),
      db.project.count({ where: { status: { in: ['IN_PROGRESS', 'REVIEW'] } } }),
      db.task.groupBy({ by: ['priority'], where: { status: { not: 'DONE' } }, _count: { _all: true } }),
      db.financeRecord.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT', status: 'RECEIVED' } }),
      db.financeRecord.aggregate({ _sum: { amount: true }, where: { type: 'EXPENSE' } }),
      db.lead.findMany({ where: { nextFollowUp: { not: null } }, orderBy: { nextFollowUp: 'asc' }, take: 5 }),
      db.project.findMany({ where: { status: { in: ['IN_PROGRESS', 'REVIEW', 'PLANNING'] } }, orderBy: { dueDate: 'asc' }, take: 5, include: { owner: { select: { name: true } } } }),
      db.activity.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { user: { select: { name: true } } } }),
      db.$queryRaw<MonthRow[]>`
        SELECT EXTRACT(MONTH FROM "date")::int AS month,
          COALESCE(SUM(CASE WHEN "type" = 'PAYMENT' THEN amount ELSE 0 END), 0)::int AS income,
          COALESCE(SUM(CASE WHEN "type" = 'EXPENSE' THEN amount ELSE 0 END), 0)::int AS expenses
        FROM "FinanceRecord"
        WHERE "date" >= ${yearStart}
        GROUP BY 1
        ORDER BY 1`,
      db.user.count(),
      db.incomingLead.count({ where: { processingStatus: 'NEW' } }),
      db.incomingLead.count({ where: { processingStatus: 'UNDER_REVIEW' } }),
      db.handoverRequest.count({ where: { status: 'PENDING' } }),
      db.deliverable.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      db.deliverable.count({ where: { status: 'CHANGES_REQUESTED' } }),
      db.automationProject.count({ where: { status: { in: ['PLANNING', 'IN_PROGRESS', 'REVIEW'] } } }),
      db.notification.count({ where: { readAt: null, userId: session?.user?.id ?? '' } }),
    ]);

  const leads = leadAgg.reduce((sum, a) => sum + a._count._all, 0);
  const openTasks = taskByPriority.reduce((sum, a) => sum + a._count._all, 0);
  const highPriority = taskByPriority.find((a) => a.priority === 'HIGH')?._count._all ?? 0;
  const pipelineValue = leadAgg
    .filter((a) => ['CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT'].includes(a.status))
    .reduce((sum, a) => sum + (a._sum.estValue ?? 0), 0);

  const statusOrder: { key: string; label: string; color: string }[] = [    { key: 'NEW', label: 'New', color: '#ff8a4c' },
    { key: 'CONTACTED', label: 'Contacted', color: '#8b5cf6' },
    { key: 'QUALIFIED', label: 'Qualified', color: '#67e8f9' },
    { key: 'PROPOSAL_SENT', label: 'Proposal sent', color: '#a895ff' },
    { key: 'WON', label: 'Won', color: '#36d399' },
    { key: 'LOST', label: 'Lost', color: '#fb7185' },
  ];
  const byStatus = new Map(leadAgg.map((a) => [a.status, { count: a._count._all, value: a._sum.estValue ?? 0 }]));
  const maxPipeline = Math.max(1, ...statusOrder.map((s) => byStatus.get(s.key as never)?.count ?? 0));

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthMap = new Map(months.map((m) => [m.month, m]));
  const maxMonth = Math.max(1, ...months.map((m) => Math.max(m.income, m.expenses)));

  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="klabel">Total leads</div><div className="num">{leads}</div><div className="kdelta"><span className="up">{pipelineValue > 0 ? `${formatMoney(pipelineValue, 'EGP')} in play` : 'Pipeline empty'}</span></div></div>
        <div className="kpi"><div className="klabel">Active projects</div><div className="num">{activeProjects}</div><div className="kdelta"><span className="warn">delivery in motion</span></div></div>
        <div className="kpi"><div className="klabel">Open tasks</div><div className="num">{openTasks}<small> / {highPriority} high</small></div><div className="kdelta"><span className={highPriority > 0 ? 'down' : 'up'}>{highPriority > 0 ? `${highPriority} need attention` : 'all calm'}</span></div></div>
        <div className="kpi"><div className="klabel">Cash received</div><div className="num">{formatMoney(paymentReceived._sum.amount)}</div><div className="kdelta"><span className="down">{-((expensesPaid._sum.amount ?? 0)) ? `− ${formatMoney(expensesPaid._sum.amount)} expenses` : 'no expenses'}</span></div></div>
        <div className="kpi"><div className="klabel">Team</div><div className="num">{userCount}</div><div className="kdelta"><span className="up">{role === 'ADMIN' ? 'you manage this space' : 'synced workspace'}</span></div></div>
      </div>

      <div className="kpis" style={{ marginTop: 4 }}>
        <Link className="kpi" href="/workspace/leads/incoming" style={{ textDecoration: 'none' }}><div className="klabel">Incoming inbox</div><div className="num">{incomingNew}<small> / {incomingReview} in research</small></div><div className="kdelta"><span className={incomingNew > 0 ? 'warn' : 'up'}>{incomingNew > 0 ? 'needs triage' : 'queue processed'}</span></div></Link>
        <Link className="kpi" href="/workspace/tasks/team" style={{ textDecoration: 'none' }}><div className="klabel">Handovers pending</div><div className="num">{handoversPending}</div><div className="kdelta"><span className={handoversPending > 0 ? 'warn' : 'up'}>{handoversPending > 0 ? 'decisions waiting' : 'no open requests'}</span></div></Link>
        <Link className="kpi" href="/workspace/deliverables" style={{ textDecoration: 'none' }}><div className="klabel">Deliverables</div><div className="num">{deliverablesReview}<small> / {deliverablesChanges} fixing</small></div><div className="kdelta"><span className={deliverablesReview > 0 ? 'warn' : 'up'}>{deliverablesReview > 0 ? 'await review' : 'review queue clear'}</span></div></Link>
        <Link className="kpi" href="/workspace/automation" style={{ textDecoration: 'none' }}><div className="klabel">Automation projects</div><div className="num">{automationsActive}</div><div className="kdelta"><span className="up">phase-gated delivery</span></div></Link>
        <Link className="kpi" href="/workspace/notifications" style={{ textDecoration: 'none' }}><div className="klabel">Unread alerts</div><div className="num">{role === 'ADMIN' ? unreadAlerts : unreadAlerts}</div><div className="kdelta"><span className={unreadAlerts > 0 ? 'warn' : 'up'}>{unreadAlerts > 0 ? 'open notifications' : 'all read'}</span></div></Link>
      </div>

      <div className="grid">
        <section className="card wide">
          <div className="panelhead">
            <h2>Payments vs expenses — {now.getFullYear()}</h2>
            <span className="quiet">monthly aggregates from the database</span>
          </div>
          <div className="chart" role="img" aria-label="Monthly payments and expenses bar chart">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const row = monthMap.get(m);
              return (
                <div key={m} style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: '100%', width: '100%' }}>
                  <div className="bar" style={{ height: `${Math.round(((row?.income ?? 0) / maxMonth) * 100)}%` }} title={`Payments ${monthNames[m - 1]}: ${formatMoney(row?.income ?? 0)}`} />
                  <div className="bar alt red" style={{ height: `${Math.round(((row?.expenses ?? 0) / maxMonth) * 100)}%` }} title={`Expenses ${monthNames[m - 1]}: ${formatMoney(row?.expenses ?? 0)}`} />
                </div>
              );
            })}
          </div>
          <div className="chart-labels">
            {monthNames.map((m) => <span key={m}>{m}</span>)}
          </div>
          <div className="legend" style={{ padding: '0 16px 14px' }}>
            <span><i style={{ background: 'linear-gradient(180deg,#a78bfa,#6d5dfc66)' }} /> payments</span>
            <span><i style={{ background: 'linear-gradient(180deg,#fb7185,#fb718533)' }} /> expenses</span>
          </div>
        </section>

        <section className="card">
          <div className="panelhead">
            <h2>Lead pipeline</h2>
            <Link className="btn sq" href="/workspace/leads">Open →</Link>
          </div>
          <div className="bars">
            {statusOrder.map((s) => {
              const row = byStatus.get(s.key as never);
              const count = row?.count ?? 0;
              const value = row?.value ?? 0;
              return (
                <div key={s.key} className="barrow">
                  <span>{s.label}</span>
                  <div className="track"><div className="pipelinefill" style={{ width: `${(count / maxPipeline) * 100}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}55)` }} /></div>
                  <span className="quiet" style={{ textAlign: 'right' }}>{count} · {formatMoney(value)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <div className="panelhead">
            <h2>Upcoming follow-ups</h2>
            <span className="quiet">soonest first</span>
          </div>
          {upcoming.length === 0 ? (
            <div className="empty" style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>No follow-ups scheduled.</div>
          ) : (
            <div>
              {upcoming.map((l) => (
                <div className="deadline" key={l.id}>
                  <div><b>{l.name}</b><div className="itemsub">{l.contactPerson ?? l.service}</div></div>
                  <span className={`pill ${l.status.toLowerCase()}`}>{labelize(l.status)}</span>
                  <small>{formatDate(l.nextFollowUp)}</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="lower">
        <section className="card">
          <div className="panelhead">
            <h2>Active projects</h2>
            <Link className="btn sq" href="/workspace/projects">All →</Link>
          </div>
          {activeProjectList.length === 0 ? (
            <div className="empty" style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>No active projects.</div>
          ) : (
            activeProjectList.map((p) => (
              <div className="taskrow" key={p.id}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ display: 'block' }}>{p.name}</b>
                  <small>{p.clientName} · {p.owner?.name ?? 'Unassigned'} · due {formatDate(p.dueDate)}</small>
                  <div className="track" style={{ marginTop: 6, width: 180 }}><div className="fill" style={{ width: `${p.progress}%`, background: progressTone(p.progress) }} /></div>
                </div>
                <span className={`pill ${p.status.toLowerCase()}`}>{labelize(p.status)}</span>
              </div>
            ))
          )}
        </section>

        <section className="card">
          <div className="panelhead"><h2>Recent activity</h2></div>
          <div className="activity-list">
            {activity.map((a) => (
              <div className="activity" key={a.id}>
                <b>{a.message}{a.user ? ` · ${a.user.name}` : ''}</b>
                <span>{a.detail}</span>
                <time dateTime={a.createdAt.toISOString()}>{formatDate(a.createdAt)}</time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
