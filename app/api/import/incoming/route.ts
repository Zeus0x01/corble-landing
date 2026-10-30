import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { parseCsv } from '@/lib/ingest';
import { domainOf } from '@/lib/ingest';

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

    const { rows, invalid } = parseCsv(bodyJson.csv);
    if (bodyJson.mode !== 'commit') {
      return Response.json({
        ok: true,
        mode: 'preview',
        total: rows.length + invalid.length,
        valid: rows.slice(0, 200),
        invalid: invalid.slice(0, 50),
      });
    }

    // COMMIT: dedupe within pool (normalized email/domain) + inside the file itself, then bulk-insert.
    const batch = await db.leadImportBatch.create({
      data: { filename: (bodyJson.filename ?? 'import.csv').slice(0, 190), totalRows: rows.length + invalid.length, importedById: userId },
    });

    const [existingEmails, existingDomains] = await Promise.all([
      db.incomingLead.findMany({ where: { email: { not: null } }, select: { email: true } }),
      db.incomingLead.findMany({ where: { domain: { not: null } }, select: { domain: true } }),
    ]);
    const seenEmails = new Set(existingEmails.map((r) => r.email as string));
    const seenDomains = new Set(existingDomains.map((r) => r.domain as string));

    const toCreate: Prisma.IncomingLeadCreateManyInput[] = [];
    let createdCount = 0;
    let dupCount = 0;
    for (const row of rows) {
      const email = row.email && row.email.includes('@') ? row.email.toLowerCase() : null;
      const website = row.website ? (/^https?:\/\//i.test(row.website) ? row.website : `https://${row.website}`) : null;
      const domain = domainOf(row.domain) ?? domainOf(website);
      const dup = (email && seenEmails.has(email)) || (domain && seenDomains.has(domain));
      if (email) seenEmails.add(email);
      if (domain) seenDomains.add(domain);
      if (dup) {
        dupCount++;
        continue;
      }
      toCreate.push({
        company: row.company.slice(0, 160),
        contactPerson: row.contactPerson,
        email,
        phone: row.phone,
        website,
        domain,
        industry: row.industry,
        location: row.location,
        source: 'CSV import',
        workflowId: null,
        batchId: String(batch.id),
        rawPayload: row as unknown as object,
        parsed: row as unknown as object,
        normalized: { email, domain, website } as object,
        processingStatus: 'NEW',
        importBatchId: batch.id,
        researchNotes: row.notes ?? null,
      });
    }
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
