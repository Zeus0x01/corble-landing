import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { ingestSchema, normalizedSummary, ingestKeyOf, rateLimit, phoneFingerprint } from '@/lib/ingest';
import { pruneRateLimits } from '@/lib/ratelimit';
import { allocateLeadCode } from '@/lib/lead-id';

export const dynamic = 'force-dynamic';

function secretOk(req: NextRequest): boolean {
  const secret = process.env.INGEST_WEBHOOK_SECRET;
  if (!secret) return false;
  const provided = req.headers.get('x-ingest-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'anon';
  if (!(await rateLimit(`ingest:${ip}`, 120))) {
    return Response.json({ ok: false, error: 'Rate limit exceeded (120/min).' }, { status: 429 });
  }
  void pruneRateLimits();
  if (!process.env.INGEST_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: 'Integration not configured (INGEST_WEBHOOK_SECRET missing).' }, { status: 503 });
  }
  if (!secretOk(req)) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = ingestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: 'Validation failed', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })).slice(0, 10) },
      { status: 422 }
    );
  }
  const payload = parsed.data;
  if (!payload.fields.email && !payload.fields.phone && !payload.fields.website && !payload.fields.domain) {
    return Response.json({ ok: false, error: 'At least one of email/phone/website/domain is required.' }, { status: 422 });
  }

  const norm = normalizedSummary(payload);
  const key = ingestKeyOf(payload);
  const batchId = payload.batchId ?? null;
  const workflowId = payload.workflowId ?? payload.source ?? 'n8n';
  const runId = `run:${workflowId}:${batchId ?? 'nobatch'}:${new Date().toISOString().slice(0, 16)}`;

  try {
    const out = await db.$transaction(async (tx) => {
      // Idempotency: same workflow+record or same external event ID returns the existing row.
      if (key) {
        const existing = await tx.incomingLead.findUnique({ where: { ingestKey: key } });
        if (existing) return { created: false, id: existing.id };
      }
      // Duplicate detection inside incoming pool by normalized email, domain,
      // or last-10-digit phone fingerprint (national vs international spelling).
      let dup = false;
      if (norm.email) {
        const d1 = await tx.incomingLead.findFirst({ where: { email: norm.email }, select: { id: true } });
        if (d1) dup = true;
      }
      const pfp = phoneFingerprint(norm.phone);
      if (!dup && pfp) {
        // Compare fingerprints instead of raw strings so +20100… and 0100… match.
        const pool = await tx.incomingLead.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } });
        if (pool.some((r) => phoneFingerprint(r.phone as string) === pfp)) dup = true;
      }
      if (!dup && norm.domain) {
        const d2 = await tx.incomingLead.findFirst({ where: { domain: norm.domain }, select: { id: true } });
        if (d2) dup = true;
      }
      const url = new URL(req.url);
      void url;
      const created = await tx.incomingLead.create({
        data: {
          leadCode: await allocateLeadCode(tx),
          company: payload.fields.company,
          contactPerson: payload.fields.contactPerson ?? null,
          email: norm.email,
          phone: norm.phone,
          website: norm.website,
          domain: norm.domain,
          industry: payload.fields.industry ?? null,
          location: payload.fields.location ?? null,
          city: payload.fields.location?.split(',')[0]?.trim() || null,
          source: payload.source,
          sourceUrl: payload.sourceUrl ?? null,
          externalId: payload.recordId ?? payload.externalEventId ?? null,
          workflowId: payload.workflowId ?? null,
          batchId: batchId,
          rawPayload: payload as unknown as object,
          parsed: payload.fields as object,
          normalized: norm as object,
          processingStatus: dup ? 'DUPLICATE' : 'NEW',
          ingestKey: key,
        },
      });
      await tx.ingestionRun.upsert({
        where: { runId },
        create: { workflowId, runId, batchId, received: 1, created: dup ? 0 : 1, duplicates: dup ? 1 : 0 },
        update: { received: { increment: 1 }, created: { increment: dup ? 0 : 1 }, duplicates: { increment: dup ? 1 : 0 }, status: 'received' },
      });
      return { created: true, id: created.id, dup };
    });

    return Response.json(
      {
        ok: true,
        id: out.id,
        created: out.created,
        duplicate: 'dup' in out ? Boolean(out.dup) : false,
        note: out.created ? undefined : 'Repeated delivery — existing record returned (idempotency).',
      },
      { status: out.created ? 201 : 200 }
    );
  } catch (e) {
    console.error('ingest error', e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: 'Ingestion failed.' }, { status: 500 });
  }
}
