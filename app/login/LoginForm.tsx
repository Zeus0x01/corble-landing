'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setBusy(false);
      setError('Wrong email or password. Accounts are created by an admin.');
      return;
    }
    router.push(params.get('from') || '/workspace');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="login-form" noValidate>
      <label className="field" htmlFor="lemail">Email
        <input id="lemail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@corble.net" />
      </label>
      <label className="field" htmlFor="lpassword">Password
        <input id="lpassword" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </label>
      {error && <div role="alert" className="login-error">{error}</div>}
      <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
        {busy ? 'Signing in…' : 'Sign in →'}
      </button>
    </form>
  );
}
