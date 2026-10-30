import { db } from '@/lib/db';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type CalItem = { day: number; title: string; href: string; sub: string; kind: 'task' | 'lead' };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const ym = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7)) - 1;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const [tasks, leads] = await Promise.all([
    db.task.findMany({ where: { dueDate: { gte: monthStart, lte: monthEnd }, deletedAt: null }, include: { assignee: { select: { name: true } }, project: { select: { name: true } } } }),
    db.lead.findMany({ where: { nextFollowUp: { gte: monthStart, lte: monthEnd } } }),
  ]);

  const items = new Map<number, CalItem[]>();
  tasks.forEach((t) => {
    if (!t.dueDate) return;
    const day = t.dueDate.getDate();
    const arr = items.get(day) ?? [];
    arr.push({ day, title: t.title, href: '/workspace/tasks', sub: t.assignee?.name ?? 'Unassigned', kind: 'task' });
    items.set(day, arr);
  });
  leads.forEach((l) => {
    if (!l.nextFollowUp) return;
    const day = l.nextFollowUp.getDate();
    const arr = items.get(day) ?? [];
    arr.push({ day, title: `Follow up: ${l.name}`, href: `/workspace/leads?q=${encodeURIComponent(l.name)}`, sub: formatMoney(l.estValue), kind: 'lead' });
    items.set(day, arr);
  });

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : 0;
  const prevYm = month === 0 ? `${year - 1}-12` : `${year}-${String(month).padStart(2, '0')}`;
  const nextYm = month === 11 ? `${year + 1}-01` : `${year}-${String(month + 2).padStart(2, '0')}`;
  const boxes: { day: number | null }[] = [
    ...Array.from({ length: firstDow }, () => ({ day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1 })),
  ];

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>{monthNames[month]} {year}</h2>
          <div className="sub">Task due dates (violet) and lead follow-ups (green) from the database.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn sq" href={`/workspace/calendar?m=${prevYm}`}>← Prev</a>
          <a className="btn sq" href={`/workspace/calendar?m=${nextYm}`}>Next →</a>
        </div>
      </div>

      <div className="card">
        <div className="cal" role="grid" aria-label="Month calendar">
          {DAYS.map((d) => <div className="cal-head" key={d}>{d}</div>)}
          {boxes.map((b, i) => (
            <div key={i} className={`cal-day${b.day === null ? ' dimday' : ''}${b.day === today ? ' today' : ''}`}>
              {b.day !== null && (
                <>
                  <div className="dnum">{b.day}</div>
                  {(items.get(b.day) ?? []).map((it, j) => (
                    <a key={j} className={`cal-item ${it.kind}`} href={it.href} title={`${it.title} (${it.sub})`}>
                      {it.title}
                    </a>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
