'use client';

import { useEffect, useState } from 'react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Workspace modules hit the database on every render. On serverless + pooled
// Postgres a cold connection can fail transiently; auto-retry once before
// showing the manual retry card.
export default function WorkspaceError({ error, reset }: Props) {
  const [autoRetried, setAutoRetried] = useState(false);

  useEffect(() => {
    if (autoRetried) return;
    setAutoRetried(true);
    const t = window.setTimeout(() => reset(), 1500);
    return () => window.clearTimeout(t);
  }, [autoRetried, reset]);

  return (
    <section className="card" style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: 32 }}>
      <h2 style={{ fontSize: 20, letterSpacing: '-0.02em', marginBottom: 8 }}>Something hiccuped</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>
        {autoRetried
          ? 'The workspace could not load this module from the database. It may be a temporary connection issue — try again.'
          : 'Retrying automatically…'}
      </p>
      <button className="btn primary" onClick={() => reset()}>Try again</button>
      {error?.digest ? <small style={{ display: 'block', marginTop: 14, color: 'var(--muted)' }}>Ref: {error.digest}</small> : null}
    </section>
  );
}
