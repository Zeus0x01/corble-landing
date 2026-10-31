import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { parseCsv } from '@/lib/ingest';
import { normalizeEmail, normalizePhone, normalizeWebsite } from '@/lib/ingest';
import { allocateLeadCodes } from '@/lib/lead-id';
import { readStoredText } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// POST { filename, csv, mode: 'preview' | 'commit' } — imports research-sourced contacts into Final Leads.
const SERVICE_DEFAULT = 'Website';

async function postImport(req: NextRequest) {
  const me = await dbUser();
  if (!me) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  const userId = me.id;

  const bodyJson = (await req.json().catch(() => null)) as { assetId?: string; filename?: string; csv?: string; mode?: string } | null;
  let csv = bodyJson?.csv;
  if (!csv && bodyJson?.assetId) {
    const asset = await db.fileAsset.findUnique({ where: { id: bodyJson.assetId }, select: { name: true, mimeType: true, storageKey: true, storage: true } });
    if (!asset) return Response.json({ ok: false, error: 'File not found.' }, { status: 404 });
    if (asset.mimeType !== 'text/csv' && !asset.name.toLowerCase().endsWith('.csv')) return Response.json({ ok: false, error: 'Only CSV files can be imported as leads.' }, { status: 415 });
    csv = await readStoredText(asset.storageKey, asset.storage) ?? undefined;
  }
  if (!bodyJson || typeof csv !== 'string' || csv.length > 2_000_000) {
    return Response.json({ ok: false, error: 'CSV too large or missing.' }, { status: 400 });
  }

  const { rows, invalid, columns } = parseCsv(csv);
  const mapped = rows.map((row) => {
    const contact = row.contactPerson;
    const valueDigits = (row.value ?? '').replace(/[^\d]/g, '');
    const location = row.location?.split(',').map((part) => part.trim()).filter(Boolean) ?? [];
    return {
      name: row.company.slice(0, 120),
      contactPerson: contact ? contact.slice(0, 120) : null,
      email: normalizeEmail(row.email),
      phone: normalizePhone(row.phone),
      website: normalizeWebsite(row.website),
      industry: row.industry ? row.industry.slice(0, 120) : null,
      city: row.city ?? location[0] ?? null,
      country: row.country ?? (location.length > 1 ? location[location.length - 1] : null),
      notes: row.notes,
      service: row.industry ? row.industry.slice(0, 80) : SERVICE_DEFAULT,
      source: row.source?.slice(0, 80) || 'CSV import',
      estValue: valueDigits ? Math.min(parseInt(valueDigits, 10) || 0, 1_000_000_000) : 0,
    };
  });
  const normalized = (s: string) => s.trim().toLowerCase();
  const existing = await db.lead.findMany({ select: { name: true, email: true, phone: true } });
  const dupNames = new Set(existing.map((l) => normalized(l.name)));
  const dupEmails = new Set(existing.map((l) => l.email).filter(Boolean).map((v) => normalized(v as string)));
  const dupPhones = new Set(existing.map((l) => l.phone).filter(Boolean).map((v) => normalized(v as string)));

  if (bodyJson.mode !== 'commit') {
    return Response.json({
      ok: true,
      total: rows.length + invalid.length,
      columns,
      dupsInDb: mapped.filter((m) => dupNames.has(normalized(m.name)) || (m.email && dupEmails.has(normalized(m.email))) || (m.phone && dupPhones.has(normalized(m.phone)))).length,
      valid: mapped.slice(0, 200),
      invalid: invalid.slice(0, 50),
    });
  }

  const toCreate: string[] = [];
  const toCreateData: Prisma.LeadCreateManyInput[] = [];
  for (const m of mapped) {
    if (dupNames.has(normalized(m.name)) || (m.email && dupEmails.has(normalized(m.email))) || (m.phone && dupPhones.has(normalized(m.phone)))) {
      continue;
    }
    dupNames.add(normalized(m.name));
    if (m.email) dupEmails.add(normalized(m.email));
    if (m.phone) dupPhones.add(normalized(m.phone));
    toCreateData.push({
      leadCode: '',
      name: m.name,
      contactPerson: m.contactPerson,
      email: m.email,
      phone: m.phone,
      website: m.website,
      industry: m.industry,
      city: m.city,
      country: m.country,
      notes: m.notes,
      service: m.service,
      source: m.source,
      status: 'NEW',
      estValue: m.estValue,
    });
    toCreate.push(m.name);
  }
  const CHUNK = 500;
  await db.$transaction(async (tx) => {
    const codes = await allocateLeadCodes(tx, toCreateData.length);
    toCreateData.forEach((row, index) => { row.leadCode = codes[index]; });
    for (let i = 0; i < toCreateData.length; i += CHUNK) {
      await tx.lead.createMany({ data: toCreateData.slice(i, i + CHUNK) });
    }
  });
  await db.activity.create({
    data: { message: 'Final leads CSV import', detail: `${toCreate.length} created, ${mapped.length - toCreate.length} duplicates, ${invalid.length} invalid`, userId },
  });
  return Response.json({ ok: true, created: toCreate.length, duplicates: mapped.length - toCreate.length, invalid: invalid.length });
}

export async function POST(req: NextRequest) {
  try {
    return await postImport(req);
  } catch (error) {
    console.error('[final-lead-import] failed:', error);
    const detail = error instanceof Error ? error.message : 'Unknown server error';
    return Response.json({ ok: false, error: `CSV import failed: ${detail}` }, { status: 500 });
  }
}
