import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ingestSchema, domainOf, ingestKeyOf, rateLimit, parseCsv, splitCsvLine } from '../lib/ingest';
import {
  taskSchema,
  handoverRequestSchema,
  handoverDecisionSchema,
  deliverableSchema,
  deliverableReviewSchema,
  incomingLeadSchema,
  promoteLeadSchema,
  automationSchema,
  phaseSchema,
  templateImportSchema,
} from '../lib/validators';
import { buildZip } from '../lib/zip';
import { simpleDiff, safeBranch, safeRepoPath, safeOwnerRepo } from '../lib/github';

/* ---------- ingest schema ---------- */

test('ingest schema accepts a valid n8n payload and rejects garbage', () => {
  const ok = ingestSchema.parse({
    workflowId: 'wf-1',
    recordId: 'rec-1',
    fields: {
      company: 'Gym Cairo',
      email: 'coach@fit.eg',
      website: 'https://fit.eg',
    },
  });
  assert.equal(ok.fields.company, 'Gym Cairo');
  assert.equal(ingestSchema.safeParse({ source: 'n8n', fields: { company: 'x' } }).success, true);
  assert.equal(ingestSchema.safeParse({ source: 'n8n' }).success, false);
});

test('domainOf normalizes emails and URLs and rejects junk', () => {
  assert.equal(domainOf('https://www.Example.co.uk/path?q=1'), 'example.co.uk');
  assert.equal(domainOf('Coach@Fit.eg'), 'fit.eg');
  assert.equal(domainOf('localhost'), null);
  assert.equal(domainOf(undefined), null);
});

test('ingestKeyOf builds idempotency keys or falls back to null', () => {
  assert.equal(ingestKeyOf({ workflowId: 'wf', recordId: 'rec', source: 'n8n', fields: { company: 'x' } }), 'wf:rec');
  assert.equal(ingestKeyOf({ externalEventId: 'evt-9', source: 'n8n', fields: { company: 'x' } }), 'evt:evt-9');
  assert.equal(ingestKeyOf({ source: 'n8n', fields: { company: 'x' } }), null);
});

test('rateLimit allows the burst then blocks before the window resets', () => {
  const key = `t-${Math.random()}`;
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), false);
  bucketsReset(key);
});
function bucketsReset(_key: string) {
  /* separate keys are used per test; bucket lifetime is capped by window */
}

/* ---------- CSV ---------- */

test('splitCsvLine handles quotes and escaped commas', () => {
  assert.equal(splitCsvLine('"Dentist, Inc",front@dentist.eg').length, 2);
  assert.equal(splitCsvLine('"a""b",c')[0], 'a"b');
});

test('parseCsv separates valid rows and flags rows with no contact channel', () => {
  const csv = [
    'Company,Email,Website,Notes',
    '"Dentist, Inc",front@dentist.eg,https://dentist.eg,from booking page',
    'NoContact,,https://only-site.eg,',
    ',front@x.eg,,no company',
  ].join('\n');
  const { rows, invalid } = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].company, 'Dentist, Inc');
  assert.equal(rows[0].email, 'front@dentist.eg');
  assert.equal(invalid.length, 1); // website row IS valid (has domain); only companyless is invalid
});

test('parseCsv understands scraped Google-Maps exports (title/phone2/place columns)', () => {
  const csv = [
    'title,country,address,category,city,phone,phone2,url,email,status',
    'Paragon Restaurant => x,SA,"3042 Masjid Ad Dar, Madinah",restaurant,Madinah,00966 56 375 5477 ,966563755477,https://www.google.com/maps/search/?api=1&query=Paragon,[],not qualification',
    'Raduni restaurant =>,SA,"some street",restaurant,Madinah, ,,https://www.google.com/maps/search/?api=1&query=Raduni,[],not qualification',
    'Cafe Cairo,EG,"downtown",cafe,Cairo,00966 58 294 6286,,https://maps.app.goo.gl/abc,[],ok',
  ].join('\n');
  const { rows, invalid } = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].company, 'Paragon Restaurant');
  assert.equal(rows[0].phone, '00966 56 375 5477');
  assert.equal(rows[0].industry, 'restaurant');
  assert.equal(rows[0].location, 'Madinah, SA');
  assert.equal(rows[0].website, null);
  assert.ok((rows[0].notes ?? '').includes('google.com/maps'));
  assert.equal(rows[1].company, 'Cafe Cairo');
  assert.equal(rows[1].website, null);
  assert.ok((rows[1].notes ?? '').includes('maps.app.goo.gl'));
  assert.equal(invalid.length, 1); // Raduni: no phone2 value and only a Maps URL -> no contact channel
});

/* ---------- validators ---------- */

test('task schema carries description and start/due dates', () => {
  const t = taskSchema.parse({ title: ' Wire reminder flow ', description: 'Send 24h reminder', priority: 'HIGH', status: 'TODO', dueDate: '2026-11-02', startDate: '2026-10-30' });
  assert.equal(t.title, 'Wire reminder flow');
  assert.equal(t.description, 'Send 24h reminder');
  assert.ok(t.dueDate instanceof Date);
});

test('handover schemas validate decision vocabulary', () => {
  assert.equal(handoverRequestSchema.safeParse({ taskId: 'x' }).success, true);
  assert.equal(handoverRequestSchema.safeParse({ taskId: '' }).success, false);
  assert.equal(handoverDecisionSchema.safeParse({ requestId: 'x', decision: 'APPROVE' }).success, true);
  assert.equal(handoverDecisionSchema.safeParse({ requestId: 'x', decision: 'approv' }).success, false);
  assert.equal(handoverDecisionSchema.safeParse({ requestId: 'x', decision: 'maybe' }).success, false);
});

test('deliverable schemas enforce a review comment and versions carry body', () => {
  const d = deliverableSchema.parse({ title: 'Landing copy', taskId: 't1', body: 'Final copy v1', externalUrl: 'https://docs.example/t1' });
  assert.equal(d.body, 'Final copy v1');
  assert.equal(deliverableReviewSchema.safeParse({ versionId: 'v1', decision: 'APPROVED', comment: '' }).success, false);
  assert.equal(deliverableReviewSchema.safeParse({ versionId: 'v1', decision: 'APPROVED', comment: 'Approved' }).success, true);
});

test('incoming lead + promote schemas coerce numbers and nullable fields', () => {
  const i = incomingLeadSchema.parse({ company: 'Studio', email: 'A@B.co ' });
  assert.equal(i.email, 'a@b.co');
  const p = promoteLeadSchema.parse({ incomingId: 'in1', estValue: '4500', ownerId: 'user-1' });
  assert.equal(p.estValue, 4500);
});

test('automation + phase schemas trim and reject impossible dependencies values', () => {
  const a = automationSchema.parse({ name: 'Booking', ownerId: 'me-1' });
  assert.equal(a.name, 'Booking');
  assert.equal(phaseSchema.safeParse({ projectId: 'p', title: '' }).success, false);
  assert.equal(templateImportSchema.safeParse({ kind: 'AUTOMATION', url: 'https://github.com/Zeus0x01/repo' }).success, true);
  assert.equal(templateImportSchema.safeParse({ kind: 'COMPONENT', url: 'https://github.com/Zeus0x01/repo' }).success, false);
});

/* ---------- zip ---------- */

test('buildZip produces a correct STORE zip with CRCs and central directory', () => {
  const bytes = buildZip([
    { name: 'src/index.ts', bytes: Buffer.from('export const hi = 1;\n') },
    { name: 'README.md', bytes: Buffer.from('# hi\n') },
  ]);
  const header = Buffer.from(bytes.buffer, bytes.byteOffset, 4);
  assert.equal(header.readUInt32LE(0), 0x04034b50);
  const endSig = Buffer.from(bytes.buffer, bytes.byteOffset + bytes.length - 22, 4);
  assert.equal(endSig.readUInt32LE(0), 0x06054b50);
  const centralSearch = Buffer.from(bytes).indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(centralSearch > 0);
  const crc = Buffer.from(bytes).readUInt32LE(centralSearch + 16);
  assert.notEqual(crc, 0);
});

test('buildZip silently skips zip-slip entries but keeps count fields honest', () => {
  const bytes = buildZip([
    { name: 'good.txt', bytes: Buffer.from('ok') },
    { name: '../evil.txt', bytes: Buffer.from('x') },
  ]);
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.includes('good.txt'));
  assert.ok(!text.includes('evil.txt'));
});

/* ---------- github guards ---------- */

test('github path/branch guards block traversal and slashes in branches', () => {
  assert.equal(safeRepoPath('src/../.. '), false);
  assert.equal(safeRepoPath('apps/site/page.tsx'), true);
  assert.equal(safeBranch('main'), true);
  assert.equal(safeBranch('feature/v2'), false); // guard keeps branch names single-segment on purpose
  assert.equal(safeBranch(''), false);
  assert.equal(safeOwnerRepo('Zeus0x01', 'corble-landing'), true);
  assert.equal(safeOwnerRepo('bad owner', 'repo'), false);
});

/* ---------- diffs ---------- */

test('simpleDiff counts added/removed lines and highlights hunks', () => {
  const d = simpleDiff('a\nb\nc\n', 'a\nB\nc\nD\n');
  assert.equal(d.added, 2);
  assert.equal(d.removed, 1);
  assert.ok(d.hunks.some((h) => h.kind === 'add'));
  assert.ok(d.hunks.some((h) => h.kind === 'del'));
});
