// Incoming-lead normalization + payload validation shared by n8n ingest API, CSV import and manual forms.
import { z } from 'zod';

export const ingestSchema = z.object({
  externalEventId: z.string().max(120).optional(),
  recordId: z.string().max(120).optional(),
  workflowId: z.string().max(120).optional(),
  batchId: z.string().max(120).optional(),
  source: z.string().max(80).default('n8n'),
  sourceUrl: z.string().max(400).optional(),
  fields: z
    .object({
      company: z.string().min(1).max(160),
      contactPerson: z.string().max(160).optional(),
      email: z.string().max(200).optional(),
      phone: z.string().max(60).optional(),
      website: z.string().max(200).optional(),
      domain: z.string().max(120).optional(),
      industry: z.string().max(120).optional(),
      location: z.string().max(160).optional(),
    })
    .passthrough(),
  extra: z.any().optional(),
});

export type IngestPayload = z.infer<typeof ingestSchema>;

export function normalizeDomain(value?: string | null): string | null {
  if (!value) return null;
  let v = value.trim().toLowerCase();
  if (v.includes('@')) v = v.split('@')[1];
  v = v.replace(/^https?:\/\//, '').replace(/\/+.*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(v) ? v : null;
}

export function normalizedSummary(p: IngestPayload) {
  const f = p.fields;
  const email = f.email && f.email.includes('@') ? f.email.trim().toLowerCase() : null;
  const website = f.website ? (/^https?:\/\//i.test(f.website) ? f.website.trim() : `https://${f.website.trim()}`) : null;
  const domain = normalizeDomain(f.domain) ?? normalizeDomain(website) ?? normalizeDomain(email);
  const phone = f.phone ? f.phone.replace(/[^\d+]/g, '') : null;
  return { email, website, domain, phone };
}

export function ingestKeyOf(p: IngestPayload): string | null {
  if (p.workflowId && p.recordId) return `${p.workflowId}:${p.recordId}`;
  if (p.externalEventId) return `evt:${p.externalEventId}`;
  return null;
}

// Alias used across modules that reference the canonical domain normalizer.
export const domainOf = normalizeDomain;

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

// --- CSV parsing/validation for import preview + commit ---
const CSV_HEAD = ['company', 'contact person', 'email', 'phone', 'website', 'domain', 'industry', 'location', 'notes'];

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export interface CsvLead {
  company: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  domain: string | null;
  industry: string | null;
  location: string | null;
  notes: string | null;
  error?: string;
}

export function parseCsv(csv: string): { rows: CsvLead[]; invalid: CsvLead[] } {
  const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], invalid: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.findIndex((h) => h === name || h.startsWith(name));
  const rows: CsvLead[] = [];
  const invalid: CsvLead[] = [];
  for (let i = 1; i < lines.length && i <= 5000; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (name: string) => {
      const j = idx(name);
      const v = j >= 0 ? (cells[j] ?? '').trim() : '';
      return v || null;
    };
    const row: CsvLead = {
      company: get('company') ?? '',
      contactPerson: get('contact person') ?? get('contact'),
      email: get('email'),
      phone: get('phone'),
      website: get('website'),
      domain: get('domain'),
      industry: get('industry'),
      location: get('location'),
      notes: get('notes'),
    };
    if (!row.company || !/[@.]/.test(`${row.email ?? ''}${row.website ?? ''}${row.phone ?? ''}`)) {
      invalid.push({ ...row, error: !row.company ? 'Missing company' : 'No email / phone / website' });
    } else {
      rows.push(row);
    }
  }
  return { rows, invalid };
}

export { CSV_HEAD, splitCsvLine };
