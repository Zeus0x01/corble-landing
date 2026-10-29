// Minimal STORE-method ZIP writer (uncompressed) + CRC32 — no external deps.
// Safe for bundling already-compressed text assets; preserves relative paths.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    if (e.name.includes('..') || /^\/|^[A-Za-z]:/.test(e.name)) continue; // zip-slip guard
    const name = enc.encode(e.name.replace(/\\/g, '/').replace(/^\/+/, ''));
    const crc = crc32(e.bytes);
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true); // version
    header.setUint16(6, 0x0800, true); // UTF-8 names
    header.setUint16(8, 0, true); // store
    header.setUint16(10, 0, true);
    header.setUint16(12, 0, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, e.bytes.length, true);
    header.setUint32(22, e.bytes.length, true);
    header.setUint16(26, name.length, true);
    header.setUint16(28, 0, true);
    locals.push(new Uint8Array(header.buffer), name, e.bytes);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, 0, true);
    c.setUint16(14, 0, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, e.bytes.length, true);
    c.setUint32(24, e.bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    centrals.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + e.bytes.length;
  }

  const centralSize = centrals.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...locals, ...centrals, new Uint8Array(end.buffer)]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}
