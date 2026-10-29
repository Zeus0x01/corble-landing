import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { parseCsv } from '@/lib/ingest';
import { domainOf } from '@/lib/ingest';

export const dynamic = 'force-dynamic';

// POST { filename, csv, mode: 'preview' | 'commit' }
export async function POST(req: NextRequest) {
  const { auth } = await import('@/lib/auth');
  const session = await auth();
  if (!session?.user?.id) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  const userId = session.user.id as string;
  const role = (session.user.role ?? 'MEMBER') as string;

  const bodyJson = (await req.json().catch(() => null)) as { filename?: string; csv?: string; mode?: string } | null;
  if (!bodyJson || typeof bodyJson.csv !== 'string' || bodyJson.csv.length > 2_000_000) {
    return Response.json({ ok: false, error: 'CSV too large or missing.' }, { status: 400 });
  }
  if (!session || (role !== 'ADMIN' && role !== 'MEMBER')) return Response.json({ ok: false, error: 'Not allowed.' }, { status: 403 });

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

    // COMMIT: re-validate + dedupe within incoming pool by normalized email/domain, create batch.
    let createdCount = 0;
    let dupCount = 0;
    let invalidCount = invalid.length;
    const batch = await db.leadImportBatch.create({
      data: { filename: (bodyJson.filename ?? 'import.csv').slice(0, 190), totalRows: rows.length + invalid.length, importedById: userId },
    });
    for (const row of [...rows]) {
      const email = row.email && row.email.includes('@') ? row.email.toLowerCase() : null;
      const website = row.website ? (/^https?:\/\//i.test(row.website) ? row.website : `https://${row.website}`) : null;
      const domain = row.domain ? domainOf(row.domain) : null;
      let dup = false;
      if (email) {
        const found = await db.incomingLead.findFirst({ where: { email }, select: { id: true } });
        if (found) dup = true;
      }
      if (!dup && domain) {
        const found = await db.incomingLead.findFirst({ where: { domain }, select: { id: true } });
        if (found) dup = true;
      }
      await db.incomingLead.create({
        data: {
          company: row.company.slice(0, 160),
          contactPerson: row.contactPerson,
          email,
          phone: row.phone,
          website,
          domain,
          industry: row.industry,
          location: row.location,
          source: (row.notes ? row.notes.slice(0, 60) : 'CSV import') || 'CSV import',
          workflowId: null,
          batchId: String(batch.id),
          rawPayload: row as unknown as object,
          parsed: row as unknown as object,
          normalized: { email, domain, website } as object,
          processingStatus: dup ? 'DUPLICATE' : 'NEW',
          importBatchId: batch.id,
          researchNotes: row.notes ?? null,
        },
      });
      if (dup) dupCount++; else createdCount++;
    }
    await db.leadImportBatch.update({
      where: { id: batch.id },
      data: { validRows: createdCount, invalidRows: invalidCount, duplicateRows: dupCount },
    });
    await db.activity.create({
      data: { message: 'CSV import committed', detail: `${batch.filename}: ${createdCount} new, ${dupCount} duplicates, ${invalidCount} invalid`, userId },
    });
    return Response.json({ ok: true, mode: 'committed', created: createdCount, duplicates: dupCount, invalid: invalidCount, batchId: batch.id });
}
