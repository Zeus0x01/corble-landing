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

// Free-mail providers can never represent a company domain (D1).
const FREE_MAIL = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'hotmail.com', 'hotmail.fr',
  'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'protonmail.com', 'proton.me', 'gmx.com', 'gmx.net', 'mail.ru',
  'yandex.com', 'yandex.ru', 'zoho.com', 'qq.com', '163.com', '126.com',
  'googlemail.com', 'hotmail.co.uk', 'ymail.com', 'rocketmail.com',
]);

export function isFreeMailDomain(d: string | null | undefined): boolean {
  return Boolean(d && FREE_MAIL.has(d.trim().toLowerCase()));
}

export function normalizeDomain(value?: string | null): string | null {
  if (!value) return null;
  let v = value.trim().toLowerCase();
  if (v.includes('@')) v = v.split('@')[1];
  v = v.replace(/^https?:\/\//, '').replace(/\/+.*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(v) ? v : null;
}

// Domain derived from an email; never a free-mail (personal) mailbox domain.
export function domainFromEmail(value?: string | null): string | null {
  const d = normalizeDomain(value);
  return isFreeMailDomain(d) ? null : d;
}

// Strict email validation: one @, no spaces/controls, a real TLD label.
export const EMAIL_STRICT_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (/\s/.test(v)) return null; // any embedded space invalidates an address
  if (!EMAIL_STRICT_RE.test(v)) return null;
  return v;
}

// Phone → digits-only national format, or E.164 when the source carries country info:
// `+20...`, `0020...`, and `+`-prefixed values normalize to a single leading `+`.
// Values without any country marker are stored as plain digits (never guessed).
export function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  let v = value.trim().replace(/[^\d+]/g, '');
  v = v.replace(/\++/g, '+');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (v === '+' || v.replace(/\D/g, '').length < 7 || v.replace(/\D/g, '').length > 15) return null;
  if (v.replace(/\D/g, '').length < 9 && !v.startsWith('+')) return null; // too short to be a real line
  return v;
}

// Fingerprint for duplicate detection across national/international spellings.
export function phoneFingerprint(value?: string | null): string | null {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

// Website normalization: force https (memory only of scrape exports), strip a
// trailing slash / index page, drop query & fragment noise, cap length.
export function normalizeWebsite(value?: string | null): string | null {
  if (!value) return null;
  let v = value.trim();
  if (!v) return null;
  if (/^(?:javascript|data|file|ftp):/i.test(v)) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v.replace(/^\/+/, '')}`;
  v = v.replace(/\?[^]*$/, '').replace(/#.*$/, '');
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol)) return null;
    let out = `${u.protocol}//${u.host.toLowerCase()}`.replace(/:80$/, '').replace(/:443$/, '');
    if (u.hostname === 'localhost' || /^127\./.test(u.hostname)) return out || null;
    let path = u.pathname.replace(/^\/+/, '');
    path = path.replace(/^(?:index|home)\.(?:html?|php|aspx?)$/i, '');
    path = path.replace(/\/(?:index|home)\.(?:html?|php|aspx?)$/i, '');
    path = path.replace(/\/+$/, '');
    if (path) out += `/${path}`;
    return out.length > 200 ? out.slice(0, 200) : out;
  } catch {
    return null;
  }
}

export function normalizedSummary(p: IngestPayload) {
  const f = p.fields;
  const email = normalizeEmail(f.email);
  const website = normalizeWebsite(f.website);
  // Domain priority: explicit → website host → email host (free-mail excluded).
  const domain = normalizeDomain(f.domain) ?? normalizeDomain(website) ?? domainFromEmail(email);
  const phone = normalizePhone(f.phone);
  return { email, website, domain, phone };
}

export function ingestKeyOf(p: IngestPayload): string | null {
  if (p.workflowId && p.recordId) return `${p.workflowId}:${p.recordId}`;
  if (p.externalEventId) return `evt:${p.externalEventId}`;
  // Deterministic fallback so repeated deliveries without IDs stay idempotent (D2).
  const f = p.fields;
  const s = normalizedSummary(p);
  const anchor = s.email ?? s.domain ?? s.website ?? s.phone ?? `${f.company}`.toLowerCase().replace(/\s+/g, ' ');
  return `content:${normalizeDomain(f.company) ?? f.company.trim().toLowerCase().slice(0, 80)}:${anchor.slice(0, 160)}`;
}

// Alias used across modules that reference the canonical domain normalizer.
export const domainOf = normalizeDomain;

// Rate limiting moved to lib/ratelimit.ts (shared DB-backed store). Re-exported
// here so existing call sites keep their import path.
export { rateLimit } from './ratelimit';

// --- CSV parsing/validation for import preview + commit ---
const CSV_HEAD = ['company', 'contact person', 'email', 'phone', 'website', 'domain', 'industry', 'location', 'notes'];

// RFC-4180 state machine: supports quoted fields containing commas AND real
// newlines (multiline quoted fields — D4), plus "" escapes.
export function parseCsvText(text: string): { rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  let started = false;
  const pushCell = () => { row.push(cur); cur = ''; started = false; };
  const pushRow = () => {
    // fully-consumed row; caller decides blankness
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"' && !cur) {
      inQ = true;
      started = true;
    } else if (c === ',') {
      pushCell();
    } else if (c === '\r') {
      if (text[i + 1] === '\n') i++;
      if (started || cur !== '' || row.length) { pushCell(); pushRow(); }
    } else if (c === '\n') {
      if (started || cur !== '' || row.length) { pushCell(); pushRow(); }
    } else {
      cur += c;
      started = true;
    }
  }
  if (inQ) cur += '"'; // unterminated quote — keep the data instead of dropping it
  if (started || cur !== '' || row.length) { pushCell(); pushRow(); }
  // Drop fully-empty rows.
  return { rows: rows.filter((r) => r.some((cell) => cell.trim().length > 0)) };
}

// Single-line variant kept for tests + one-off parsing.
export function splitCsvLine(line: string): string[] {
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
  value: string | null;
  error?: string;
}

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

const CSV_ALIASES: Record<keyof Omit<CsvLead, 'error'>, string[]> = {
  company: ['company', 'company name', 'name', 'business', 'business name', 'organization', 'organisation', 'title', 'business title', 'place name', 'listing'],
  contactPerson: ['contact person', 'contact', 'contact name', 'person', 'owner'],
  email: ['email', 'e mail', 'mail', 'email address', 'email1'],
  phone: ['phone', 'tel', 'telephone', 'mobile', 'phone number', 'whatsapp'],
  website: ['website', 'url', 'site', 'link', 'homepage', 'site url'],
  domain: ['domain', 'website domain', 'host'],
  industry: ['industry', 'category', 'sector', 'business type', 'type', 'categories'],
  location: ['location', 'city', 'address', 'country', 'state', 'region'],
  notes: ['notes', 'note', 'description', 'summary', 'comment'],
  value: ['value', 'est value', 'estimated value', 'budget', 'price', 'potential value'],
};

export function parseCsv(csv: string): { rows: CsvLead[]; invalid: CsvLead[] } {
  const table = parseCsvText(csv);
  if (table.rows.length < 2) return { rows: [], invalid: [] };
  const [header, ...body] = table.rows;
  const headers = header.map(normHeader);
  const MAX_ROWS = 5000;
  if (body.length > MAX_ROWS) return { rows: [], invalid: [{ ...emptyLead(), error: `File too large: ${body.length} rows > ${MAX_ROWS} — split the file` }] };
  const fieldsOrder = Object.keys(CSV_ALIASES) as (keyof Omit<CsvLead, 'error'>)[];
  const colFor = new Map<keyof Omit<CsvLead, 'error'>, number>();
  const used = new Set<number>();
  for (const f of fieldsOrder) {
    // Alias-priority match: the first alias in the list wins over a leftmost header,
    // so e.g. a City column isn't shadowed by a Country column.
    for (const a of CSV_ALIASES[f]) {
      const j = headers.findIndex((h) => h === a);
      if (j >= 0 && !used.has(j)) {
        colFor.set(f, j);
        used.add(j);
        break;
      }
    }
  }
  for (const f of fieldsOrder) {
    if (colFor.has(f)) continue;
    const j = headers.findIndex((h, i) => !used.has(i) && CSV_ALIASES[f].some((a) => h.startsWith(`${a} `) || (h !== a && h.replace(/\s*\d+$/, '') === a)));
    if (j >= 0) {
      colFor.set(f, j);
      used.add(j);
    }
  }
  const cols = (f: keyof Omit<CsvLead, 'error'>) => colFor.get(f) ?? -1;
  // Scrape exports often carry a second phone column (phone2) — used as fallback only.
  const phone2Col = headers.findIndex((h, i) => !used.has(i) && /^(phone ?2|mobile ?2|tel ?2|second phone|secondary phone|alt phone)$/.test(h));
  const countryCol = headers.findIndex((h, i) => !used.has(i) && h === 'country');
  const rows: CsvLead[] = [];
  const invalid: CsvLead[] = [];
  for (const cells of body) {
    const get = (col: number) => {
      const v = col >= 0 ? (cells[col] ?? '').trim() : '';
      return v || null;
    };
    let phone = normalizePhone(get(cols('phone')));
    if (!phone && phone2Col >= 0) phone = normalizePhone((cells[phone2Col] ?? '').trim());
    let website = get(cols('website'));
    let notes = get(cols('notes'));
    // Directory URLs (Google Maps etc.) are not company websites — park them in notes
    // instead of polluting the website/domain fields and duplicate detection.
    if (website && /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|google\.[a-z.]+\/search/i.test(website)) {
      notes = [notes, `Maps: ${website.slice(0, 190)}`].filter(Boolean).join(' | ') || null;
      website = null;
    }
    const emailRaw = get(cols('email'));
    // Scrape exports carry junk like "[]" or "-" in the email column — values
    // without any @ are treated as missing; only broken-with-@ values are flagged.
    const looksLikeEmail = Boolean(emailRaw && emailRaw.includes('@'));
    const email = looksLikeEmail ? normalizeEmail(emailRaw) : null;
    const row: CsvLead = {
      company: get(cols('company')) ?? '',
      contactPerson: get(cols('contactPerson')),
      email,
      phone,
      website,
      domain: get(cols('domain')),
      industry: get(cols('industry')),
      location: get(cols('location')),
      notes,
      value: get(cols('value')),
    };
    // Scrape titles often embed a trailing " original => translated" pair — keep the readable prefix.
    const cut = row.company.split('=>')[0].trim();
    if (cut) row.company = cut;
    if (row.location && countryCol >= 0) {
      const country = (cells[countryCol] ?? '').trim();
      if (country && !row.location.toLowerCase().includes(country.toLowerCase())) row.location = `${row.location}, ${country}`;
    }
    const phoneOk = Boolean(phone);
    const webOk = Boolean(row.website && /\./.test(row.website));
    const domainOk = Boolean(row.domain && /\./.test(row.domain));
    if (!row.company) {
      invalid.push({ ...row, error: 'Missing company' });
    } else if (looksLikeEmail && !email) {
      invalid.push({ ...row, error: `Invalid email "${emailRaw!.slice(0, 60)}"` });
    } else if (!email && !phoneOk && !webOk && !domainOk) {
      invalid.push({
        ...row,
        error: [cols('email'), cols('phone'), cols('website'), cols('domain')].some((c) => c >= 0)
          ? 'No usable email / phone / website value'
          : 'No email / phone / website column found in header',
      });
    } else {
      rows.push(row);
    }
  }
  return { rows, invalid };
}

function emptyLead(): CsvLead {
  return { company: '', contactPerson: null, email: null, phone: null, website: null, domain: null, industry: null, location: null, notes: null, value: null };
}

export { CSV_HEAD };
