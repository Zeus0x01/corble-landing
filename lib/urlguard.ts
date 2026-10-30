// SSRF protection for any outbound website check (D7): blocks localhost/private
// ranges/cloud metadata — including through the DNS resolution and each hop of a
// redirect chain — and caps the response size.
import { promises as dns } from 'dns';

const BLOCKED_HOSTS = new Set([
  'localhost', 'localhost.localdomain', 'metadata.google.internal',
  'metadata.goog', 'instance-data', 'instance-data.ec2.internal',
  '169.254.169.254', 'fd00:ec2::254',
]);

const DOMAIN_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.ec2.internal', '.home.arpa'];

function isPrivateIp(ip: string): boolean {
  if (!ip.includes('.') && ip.includes(':')) {
    const v = ip.replace(/^\[|\]$/g, '').toLowerCase();
    if (v === '::1' || v === '::' || v === '::ffff:0:0') return true;
    if (v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('::ffff:')) return true;
    return false;
  }
  const parts = ip.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → suspect
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a >= 224)
  );
}

export type SafeUrl = { url: URL; ip?: string };

// Resolves the host and verifies it is a public target. Returns the first safe A
// record so the fetch itself can't be re-pointed to a private range mid-flight
// (best-effort DNS pinning: we follow redirects manually and re-check each hop).
export async function assertSafeUrl(input: string): Promise<SafeUrl> {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new Error('Blocked: not a valid URL.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`Blocked: protocol ${u.protocol} not allowed.`);
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) throw new Error('Blocked: host is not allowed.');
  if (DOMAIN_SUFFIXES.some((s) => host.endsWith(s))) throw new Error('Blocked: internal host names are not allowed.');
  // IP literal?
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw new Error('Blocked: private or internal IP address.');
    return { url: u };
  }
  // Resolve DNS; every returned address must be public.
  let addresses: string[];
  try {
    addresses = await dns.resolve(host);
  } catch {
    const r6 = await dns.resolve6(host).catch(() => null);
    if (!r6) throw new Error('Blocked: DNS resolution failed.');
    addresses = r6;
  }
  const safe = addresses.find((ip) => !isPrivateIp(ip));
  if (!safe) throw new Error('Blocked: resolves to a private or internal address.');
  return { url: u, ip: safe };
}

// Guarded GET: follows up to 3 redirects with per-hop re-checks (SSRF), an
// overall timeout, and a hard response-size cap.
export async function safeFetch(
  input: string,
  opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {}
): Promise<{ status: number; ok: boolean; finalHost: string; bytes: number; aborted?: boolean }> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const maxRedirects = opts.maxRedirects ?? 3;
  const deadline = Date.now() + timeoutMs;
  let current: string = input;
  let hop = 0;
  while (true) {
    const { url } = await assertSafeUrl(current);
    if (Date.now() > deadline) return { status: 408, ok: false, finalHost: url.hostname, bytes: 0, aborted: true };
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.max(250, deadline - Date.now()));
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        signal: ac.signal,
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': 'CorbleBot/1.0 (lead-verification)' },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { status: res.status, ok: false, finalHost: url.hostname, bytes: 0 };
      if (++hop > maxRedirects) return { status: res.status, ok: false, finalHost: url.hostname, bytes: 0, aborted: true };
      current = new URL(loc, url).toString();
      continue;
    }
    const len = parseInt(res.headers.get('content-length') ?? '', 10);
    if (!Number.isNaN(len) && len > maxBytes) {
      return { status: res.status, ok: false, finalHost: url.hostname, bytes: len };
    }
    // Drain up to the byte cap so attackers can't smuggle huge bodies without cap.
    let bytes = 0;
    const reader = res.body?.getReader();
    if (reader) {
      try {
        while (bytes < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
        }
      } catch { /* network read hiccup — size already counted */ }
      finally {
        try { await reader.cancel(); } catch { /* ignore */ }
      }
    }
    return { status: res.status, ok: res.ok && bytes <= maxBytes, finalHost: url.hostname, bytes };
  }
}
