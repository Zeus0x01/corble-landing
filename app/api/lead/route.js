import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const data = await req.json();
    if (!data.name || !String(data.email).includes('@')) {
      return Response.json({ ok: false }, { status: 400 });
    }
    const entry = { ...data, at: new Date().toISOString() };
    try {
      const dir = path.join(process.cwd(), 'data');
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, 'leads.json');
      let leads = [];
      try { leads = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
      leads.push(entry);
      await fs.writeFile(file, JSON.stringify(leads, null, 2));
    } catch {}
    console.log('New lead:', data.name, data.email);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
