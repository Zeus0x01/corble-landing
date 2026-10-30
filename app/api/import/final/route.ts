import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { parseCsv } from '@/lib/ingest';

export const dynamic = 'force-dynamic';

// POST { filename, csv, mode: 'preview' | 'commit' } — imports research-sourced contacts into Final Leads.
const SERVICE_DEFAULT = 'Website';

export async function POST(req: NextRequest) {
  const me = await dbUser();
  if (!me) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  const userId = me.id;

  const bodyJson = (await req.json().catch(() => null)) as { filename?: string; csv?: string; mode?: string } | null;
  if (!bodyJson || typeof bodyJson.csv !== 'string' || bodyJson.csv.length > 2_000_000) {
    return Response.json({ ok: false, error: 'CSV too large or missing.' }, { status: 400 });
  }

  const { rows, invalid } = parseCsv(bodyJson.csv);
  const mapped = rows.map((row) => {
    const contact = row.contactPerson ?? row.email ?? row.phone;
    const valueDigits = (row.value ?? '').replace(/[^\d]/g, '');
    return {
      name: row.company.slice(0, 120),
      contactPerson: contact ? contact.slice(0, 120) : null,
      service: row.industry ? row.industry.slice(0, 80) : SERVICE_DEFAULT,
      source: 'Cold Outreach',
      estValue: valueDigits ? Math.min(parseInt(valueDigits, 10) || 0, 1_000_000_000) : 0,
    };
  });
  const normalized = (s: string) => s.trim().toLowerCase();
  const dupNames = new Set((await db.lead.findMany({ select: { name: true } })).map((l) => normalized(l.name)));

  if (bodyJson.mode !== 'commit') {
    return Response.json({
      ok: true,
      total: rows.length + invalid.length,
      dupsInDb: mapped.filter((m) => dupNames.has(normalized(m.name))).length,
      valid: mapped.slice(0, 200),
      invalid: invalid.slice(0, 50),
    });
  }

  const toCreate: string[] = [];
  const toCreateData: Prisma.LeadCreateManyInput[] = [];
  for (const m of mapped) {
    if (dupNames.has(normalized(m.name))) {
      continue;
    }
    dupNames.add(normalized(m.name));
    toCreateData.push({
      name: m.name,
      contactPerson: m.contactPerson,
      service: m.service,
      source: m.source,
      status: 'NEW',
      estValue: m.estValue,
    });
    toCreate.push(m.name);
  }
  const CHUNK = 500;
  for (let i = 0; i < toCreateData.length; i += CHUNK) {
    await db.lead.createMany({ data: toCreateData.slice(i, i + CHUNK) });
  }
  await db.activity.create({
    data: { message: 'Final leads CSV import', detail: `${toCreate.length} created, ${mapped.length - toCreate.length} duplicates, ${invalid.length} invalid`, userId },
  });
  return Response.json({ ok: true, created: toCreate.length, duplicates: mapped.length - toCreate.length, invalid: invalid.length });
}
