'use client';

import { useEffect, useState } from 'react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  const [autoRetried, setAutoRetried] = useState(false);

  useEffect(() => {
    if (autoRetried) return;
    setAutoRetried(true);
    const t = window.setTimeout(() => reset(), 1500);
    return () => window.clearTimeout(t);
  }, [autoRetried, reset]);

  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, letterSpacing: '-0.02em' }}>Something hiccuped</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>
          {autoRetried
            ? 'This page could not load. It may be a temporary issue — try again.'
            : 'Retrying automatically…'}
        </p>
        <button className="btn primary" onClick={() => reset()}>Try again</button>
        {error?.digest ? <small style={{ display: 'block', marginTop: 14, color: 'var(--muted)' }}>Ref: {error.digest}</small> : null}
      </div>
    </main>
  );
}
