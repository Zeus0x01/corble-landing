import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { parseCsv, normalizeEmail, normalizePhone, phoneFingerprint, normalizeWebsite, isFreeMailDomain } from '@/lib/ingest';
import { domainOf } from '@/lib/ingest';
import { allocateLeadCodes } from '@/lib/lead-id';

export const dynamic = 'force-dynamic';

// POST { filename, csv, mode: 'preview' | 'commit' }
export async function POST(req: NextRequest) {
  const me = await dbUser();
  if (!me) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  const userId = me.id;
  const role = me.role;

  const bodyJson = (await req.json().catch(() => null)) as { filename?: string; csv?: string; mode?: string } | null;
  if (!bodyJson || typeof bodyJson.csv !== 'string' || bodyJson.csv.length > 2_000_000) {
    return Response.json({ ok: false, error: 'CSV too large or missing.' }, { status: 400 });
  }
  if (!(role === 'ADMIN' || role === 'MEMBER')) return Response.json({ ok: false, error: 'Not allowed.' }, { status: 403 });

    const { rows, invalid, columns } = parseCsv(bodyJson.csv);
    if (bodyJson.mode !== 'commit') {
      return Response.json({
        ok: true,
        mode: 'preview',
        total: rows.length + invalid.length,
        columns,
        valid: rows.slice(0, 200),
        invalid: invalid.slice(0, 50),
      });
    }

    // COMMIT: dedupe within pool (normalized email/domain + phone fingerprint)
    // + inside the file itself, then bulk-insert.
    const batch = await db.leadImportBatch.create({
      data: { filename: (bodyJson.filename ?? 'import.csv').slice(0, 190), totalRows: rows.length + invalid.length, importedById: userId },
    });

    const [existingEmails, existingDomains, existingPhones] = await Promise.all([
      db.incomingLead.findMany({ where: { email: { not: null } }, select: { email: true } }),
      db.incomingLead.findMany({ where: { domain: { not: null } }, select: { domain: true } }),
      db.incomingLead.findMany({ where: { phone: { not: null } }, select: { phone: true } }),
    ]);
    const seenEmails = new Set(existingEmails.map((r) => r.email as string));
    const seenDomains = new Set(existingDomains.map((r) => r.domain as string));
    const seenPhones = new Set(existingPhones.map((r) => phoneFingerprint(r.phone as string)).filter(Boolean));

    const toCreate: Prisma.IncomingLeadCreateManyInput[] = [];
    let createdCount = 0;
    let dupCount = 0;
    for (const row of rows) {
      const email = normalizeEmail(row.email);
      const website = normalizeWebsite(row.website);
      // A gmail/yahoo/… email is a person's inbox, never the company domain (D1).
      const rawDomain = domainOf(row.domain) ?? domainOf(website);
      const domain = rawDomain && !isFreeMailDomain(rawDomain) ? rawDomain : null;
      const phone = normalizePhone(row.phone);
      const pfp = phoneFingerprint(phone);
      const dup =
        (email && seenEmails.has(email)) ||
        (domain && seenDomains.has(domain)) ||
        (pfp && seenPhones.has(pfp));
      if (email) seenEmails.add(email);
      if (domain) seenDomains.add(domain);
      if (pfp) seenPhones.add(pfp);
      if (dup) {
        dupCount++;
        continue;
      }
      toCreate.push({
        leadCode: '',
        company: row.company.slice(0, 160),
        contactPerson: row.contactPerson,
        email,
        phone,
        website,
        domain,
        industry: row.industry,
        location: row.location,
        source: row.source?.slice(0, 80) || 'CSV import',
        workflowId: null,
        batchId: String(batch.id),
        rawPayload: row as unknown as object,
        parsed: row as unknown as object,
        normalized: { email, domain, website, phone } as object,
        processingStatus: 'NEW',
        importBatchId: batch.id,
        researchNotes: row.notes ?? null,
      });
    }
    const codes = await db.$transaction(async (tx) => allocateLeadCodes(tx, toCreate.length));
    toCreate.forEach((row, index) => {
      row.leadCode = codes[index];
      const location = row.location?.split(',').map((part) => part.trim()).filter(Boolean) ?? [];
      row.city = row.city ?? location[0] ?? null;
      row.country = row.country ?? (location.length > 1 ? location[location.length - 1] : null);
    });
    const CHUNK = 500;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      await db.incomingLead.createMany({ data: toCreate.slice(i, i + CHUNK) });
    }
    createdCount = toCreate.length;
    await db.leadImportBatch.update({
      where: { id: batch.id },
      data: { validRows: createdCount, invalidRows: invalid.length, duplicateRows: dupCount },
    });
    await db.activity.create({
      data: { message: 'CSV import committed', detail: `${batch.filename}: ${createdCount} new, ${dupCount} duplicates, ${invalid.length} invalid`, userId },
    });
    return Response.json({ ok: true, mode: 'committed', created: createdCount, duplicates: dupCount, invalid: invalid.length, batchId: batch.id });
}
