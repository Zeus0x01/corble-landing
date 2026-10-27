import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csv(rows: (string | number | null)[][]): string {
  return rows
    .map((r) => r.map((c) => csvEscape(c === null || c === undefined ? '' : String(c))).join(','))
    .join('\r\n');
}

export async function GET(_req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  let rows: (string | number | null)[][] = [];
  let filename = 'export.csv';

  if (entity === 'leads') {
    const data = await db.lead.findMany({ include: { owner: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    const body = data.map((l) => [
      l.name,
      l.contactPerson ?? '',
      l.service,
      l.source,
      l.status,
      l.estValue,
      l.nextFollowUp ? l.nextFollowUp.toISOString().slice(0, 10) : '',
      l.owner?.name ?? '',
      l.createdAt.toISOString(),
    ] as (string | number)[]);
    rows = [
      ['Company', 'Contact', 'Service', 'Source', 'Status', 'EstValue', 'FollowUp', 'Owner', 'CreatedAt'],
      ...body,
    ];
    filename = 'leads.csv';
  } else if (entity === 'projects') {
    const data = await db.project.findMany({ include: { owner: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    const body = data.map((p) => [
      p.name,
      p.clientName,
      p.service,
      p.status,
      p.progress,
      p.dueDate ? p.dueDate.toISOString().slice(0, 10) : '',
      p.budget,
      p.owner?.name ?? '',
      p.createdAt.toISOString(),
    ] as (string | number)[]);
    rows = [
      ['Name', 'Client', 'Service', 'Status', 'Progress', 'DueDate', 'Budget', 'Owner', 'CreatedAt'],
      ...body,
    ];
    filename = 'projects.csv';
  } else if (entity === 'tasks') {
    const data = await db.task.findMany({
      include: { assignee: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const body = data.map((t) => [
      t.title,
      t.project?.name ?? '',
      t.assignee?.name ?? '',
      t.priority,
      t.status,
      t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '',
      t.createdAt.toISOString(),
    ] as (string | number)[]);
    rows = [
      ['Title', 'Project', 'Assignee', 'Priority', 'Status', 'DueDate', 'CreatedAt'],
      ...body,
    ];
    filename = 'tasks.csv';
  } else if (entity === 'finance') {
    const data = await db.financeRecord.findMany({ orderBy: { date: 'desc' }, include: { project: { select: { name: true } } } });
    const body = data.map((f) => [
      f.type,
      f.description,
      f.amount,
      f.status,
      f.date.toISOString().slice(0, 10),
      f.project?.name ?? '',
    ] as (string | number)[]);
    rows = [
      ['Type', 'Description', 'Amount', 'Status', 'Date', 'Project'],
      ...body,
    ];
    filename = 'finance.csv';
  } else {
    return new Response('Unknown export entity', { status: 404 });
  }

  return new Response(`\ufeff${csv(rows)}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
