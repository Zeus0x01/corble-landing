'use client';

import { useState } from 'react';

export default function LeadCodeCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn sq"
      type="button"
      title={`Copy ${code}`}
      aria-label={`Copy ${code}`}
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}
