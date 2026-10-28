/**
 * Static social-image generator — run with: npx tsx scripts/generate-og.tsx
 * Writes app/opengraph-image.png (1200x630) and app/apple-icon.png (180x180).
 */
import { ImageResponse } from 'next/og';
import * as React from 'react';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BG = '#0a0c10';
const LIME = '#c8ff00';
const BORDER = 'rgba(255, 255, 255, 0.02)';

async function loadFonts() {
  const dir = path.resolve(process.cwd(), 'scripts', 'fonts');
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, 'inter-400.ttf')),
    readFile(path.join(dir, 'inter-800.ttf')),
  ]);
  return [
    { name: 'Inter', data: regular, weight: '400' as never, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: '800' as never, style: 'normal' as const },
  ];
}

export function OgLayout() {
  const glow = (grad: string): React.CSSProperties => ({
    position: 'absolute', borderRadius: '50%', backgroundImage: grad, opacity: 0.5,
  });
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '72px', position: 'relative', overflow: 'hidden',
        backgroundColor: BG,
      }}
    >
      <div style={{ width: 900, height: 900, top: -420, right: -260, backgroundImage: 'linear-gradient(160deg, rgba(200,255,0,0.16), rgba(200,255,0,0) 62%)', ...glow('') } as React.CSSProperties} />
      <div style={{ width: 1000, height: 1000, bottom: -480, left: -300, backgroundImage: 'linear-gradient(20deg, rgba(124,58,237,0.30), rgba(124,58,237,0) 60%)', ...glow('') } as React.CSSProperties} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${LIME}, #7da800)`, fontSize: 34, fontWeight: 800, color: BG,
          }}
        >
          C
        </div>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>Corble</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 14, alignSelf: 'flex-start',
            padding: '10px 22px', border: `1px solid rgba(200,255,0,0.35)`, borderRadius: 999,
            backgroundColor: 'rgba(200,255,0,0.08)', color: LIME, fontSize: 22, fontWeight: 800, letterSpacing: '0.14em',
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: LIME }} />
          PRACTICAL WEBSITES & AUTOMATION SYSTEMS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 84, fontWeight: 800, color: 'white', letterSpacing: '-0.05em', lineHeight: 1.06 }}>
          <div style={{ display: 'flex' }}>Decisions,</div>
          <div style={{ display: 'flex' }}>
            not&nbsp;
            <span style={{ color: LIME }}>dashboards.</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: 'rgba(255,255,255,0.72)', maxWidth: 880 }}>
          Lead capture, follow-ups, bookings and anomaly alerts — one quiet system that runs the busywork.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${BORDER}`, paddingTop: 28 }}>
        <div style={{ display: 'flex', gap: 16, color: LIME, fontSize: 24, fontWeight: 800, alignItems: 'center' }}>
        {['11 hrs saved / week', '3.2× faster response', '40+ integrations'].map((t) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: LIME }} />
            {t}
          </div>
        ))}
      </div>
        <div style={{ display: 'flex', fontSize: 26, color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>corble.net</div>
      </div>
    </div>
  );
}

async function main() {
  const fonts = await loadFonts();

  const og = new ImageResponse(<OgLayout />, {
    width: 1200,
    height: 630,
    fonts,
  });
  await writeFile(path.resolve('app', 'opengraph-image.png'), Buffer.from(await og.arrayBuffer()));
  console.log('wrote app/opengraph-image.png');

  const icon = new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 36, overflow: 'hidden', position: 'relative', backgroundColor: BG,
        }}
      >
        <div style={{ width: 260, height: 260, top: -110, right: -80, position: 'absolute', borderRadius: '50%', backgroundImage: 'linear-gradient(200deg, rgba(124,58,237,0.5), rgba(124,58,237,0) 65%)' }} />
        <div
          style={{
            width: 118, height: 118, borderRadius: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${LIME}, #7da800)`, fontSize: 76, fontWeight: 800, color: BG,
          }}
        >
          C
        </div>
      </div>
    ),
    { width: 180, height: 180, fonts },
  );
  await writeFile(path.resolve('app', 'apple-icon.png'), Buffer.from(await icon.arrayBuffer()));
  console.log('wrote app/apple-icon.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
