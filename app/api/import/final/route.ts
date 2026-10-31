import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { dbUser } from '@/lib/guard';
import { parseCsv } from '@/lib/ingest';
import { normalizeEmail, normalizePhone, normalizeWebsite } from '@/lib/ingest';
import { allocateLeadCodes } from '@/lib/lead-id';
import { readStoredText, saveUpload } from '@/lib/storage';
import { readStoredBuffer } from '@/lib/storage';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// POST { filename, csv, mode: 'preview' | 'commit' | 'draft' } — imports research-sourced contacts into Final Leads.
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
    const isExcel = /\.(xlsx|xls)$/i.test(asset.name);
    if (!isExcel && asset.mimeType !== 'text/csv' && !asset.name.toLowerCase().endsWith('.csv')) return Response.json({ ok: false, error: 'Only CSV and Excel files can be imported as leads.' }, { status: 415 });
    if (isExcel) {
      const buffer = await readStoredBuffer(asset.storageKey, asset.storage);
      if (buffer) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
      }
    } else {
      csv = await readStoredText(asset.storageKey, asset.storage) ?? undefined;
    }
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

  // ─── DRAFT MODE ────────────────────────────────────────────────────────────
  // Create a new independent draft file + dataset.
  // Do NOT switch the active view — keep the user's current data visible.
  if (bodyJson.mode === 'draft') {
    const filename = (bodyJson.filename || 'leads.csv').slice(0, 160);
    const { storageKey, storage } = await saveUpload(new File([csv], filename, { type: 'text/csv' }));
    const asset = await db.fileAsset.create({
      data: {
        name: filename,
        size: Buffer.byteLength(csv, 'utf8'),
        mimeType: /\.(xlsx|xls)$/i.test(filename)
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
        storageKey,
        storage,
        uploadedById: userId,
      },
      select: { id: true },
    });
    const dataset = await db.leadDataset.create({
      data: { fileAssetId: asset.id, ownerId: userId },
      select: { id: true },
    });

    // Important: we deliberately do NOT update leadWorkspaceState here.
    // The new draft appears in the horizontal bar, but the currently
    // active file (with real data) stays active until the user clicks it.

    return Response.json({
      ok: true,
      assetId: asset.id,
      datasetId: dataset.id,
      total: rows.length + invalid.length,
      columns,
      dupsInDb: mapped.filter(
        (m) =>
          dupNames.has(normalized(m.name)) ||
          (m.email && dupEmails.has(normalized(m.email))) ||
          (m.phone && dupPhones.has(normalized(m.phone)))
      ).length,
      valid: mapped.slice(0, 200),
      invalid: invalid.slice(0, 50),
    });
  }

  // ─── PREVIEW MODE ──────────────────────────────────────────────────────────
  if (bodyJson.mode !== 'commit') {
    return Response.json({
      ok: true,
      total: rows.length + invalid.length,
      columns,
      dupsInDb: mapped.filter(
        (m) =>
          dupNames.has(normalized(m.name)) ||
          (m.email && dupEmails.has(normalized(m.email))) ||
          (m.phone && dupPhones.has(normalized(m.phone)))
      ).length,
      valid: mapped.slice(0, 200),
      invalid: invalid.slice(0, 50),
    });
  }

  // ─── COMMIT MODE ───────────────────────────────────────────────────────────
  let assetId = bodyJson.assetId;
  if (assetId) {
    const existingDataset = await db.leadDataset.findUnique({
      where: { fileAssetId: assetId },
      select: { id: true, _count: { select: { leads: true } } },
    });
    if (existingDataset) {
      if (existingDataset._count.leads === 0) {
        // Pure draft → switch to it and import
        await db.leadWorkspaceState.upsert({
          where: { userId },
          create: { userId, activeDatasetId: existingDataset.id },
          update: { activeDatasetId: existingDataset.id },
        });
      } else {
        // Already has leads — just ensure links + switch
        const datasetLeads = await db.lead.findMany({ where: { datasetId: existingDataset.id }, select: { id: true } });
        const linked = await db.fileLeadLink.findMany({
          where: { fileAssetId: assetId, kind: 'LEAD' },
          select: { leadId: true },
        });
        const linkedIds = new Set(linked.map((link) => link.leadId));
        const missing = datasetLeads.filter((lead) => !linkedIds.has(lead.id));
        if (missing.length) {
          await db.fileLeadLink.createMany({
            data: missing.map((lead) => ({ kind: 'LEAD', leadId: lead.id, fileAssetId: assetId! })),
          });
        }
        await db.leadWorkspaceState.upsert({
          where: { userId },
          create: { userId, activeDatasetId: existingDataset.id },
          update: { activeDatasetId: existingDataset.id },
        });
        return Response.json({
          ok: true,
          created: 0,
          duplicates: mapped.length,
          invalid: invalid.length,
          datasetId: existingDataset.id,
        });
      }
    }
  } else {
    const filename = (bodyJson.filename || 'leads.csv').slice(0, 160);
    const { storageKey, storage } = await saveUpload(new File([csv], filename, { type: 'text/csv' }));
    const excel = /\.(xlsx|xls)$/i.test(filename);
    const asset = await db.fileAsset.create({
      data: {
        name: filename,
        size: Buffer.byteLength(csv, 'utf8'),
        mimeType: excel
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
        storageKey,
        storage,
        uploadedById: userId,
      },
      select: { id: true },
    });
    assetId = asset.id;
  }

  const toCreate: string[] = [];
  const toCreateData: Prisma.LeadCreateManyInput[] = [];
  const importedNames = new Set<string>();
  const importedEmails = new Set<string>();
  const importedPhones = new Set<string>();
  for (const m of mapped) {
    const nameKey = normalized(m.name);
    const emailKey = m.email ? normalized(m.email) : '';
    const phoneKey = m.phone ? normalized(m.phone) : '';
    if (
      importedNames.has(nameKey) ||
      (emailKey && importedEmails.has(emailKey)) ||
      (phoneKey && importedPhones.has(phoneKey))
    ) {
      continue;
    }
    importedNames.add(nameKey);
    if (emailKey) importedEmails.add(emailKey);
    if (phoneKey) importedPhones.add(phoneKey);
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
  const datasetId = await db.$transaction(async (tx) => {
    const dataset =
      (await tx.leadDataset.findUnique({ where: { fileAssetId: assetId! }, select: { id: true } })) ??
      (await tx.leadDataset.create({ data: { fileAssetId: assetId!, ownerId: userId }, select: { id: true } }));

    const codes = await allocateLeadCodes(tx, toCreateData.length);
    toCreateData.forEach((row, index) => {
      row.leadCode = codes[index];
    });

    for (let i = 0; i < toCreateData.length; i += CHUNK) {
      await tx.lead.createMany({
        data: toCreateData.slice(i, i + CHUNK).map((row) => ({ ...row, datasetId: dataset.id })),
      });
    }

    if (toCreateData.length) {
      const created = await tx.lead.findMany({ where: { datasetId: dataset.id }, select: { id: true } });
      await tx.fileLeadLink.createMany({
        data: created.map((lead) => ({ kind: 'LEAD', leadId: lead.id, fileAssetId: assetId! })),
      });
    }
    return dataset.id;
  });

  await db.activity.create({
    data: {
      message: 'Final leads CSV import',
      detail: `${toCreate.length} created, ${mapped.length - toCreate.length} duplicates, ${invalid.length} invalid`,
      userId,
    },
  });

  // After a successful import we DO switch to the newly imported dataset
  await db.leadWorkspaceState.upsert({
    where: { userId },
    create: { userId, activeDatasetId: datasetId },
    update: { activeDatasetId: datasetId },
  });

  return Response.json({
    ok: true,
    created: toCreate.length,
    duplicates: mapped.length - toCreate.length,
    invalid: invalid.length,
    datasetId,
  });
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
