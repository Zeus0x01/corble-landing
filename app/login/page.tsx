import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Sign in · Corble Workspace' };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/workspace');

  return (
    <main className="login-page">
      <div className="aurora" style={{ width: 420, height: 420, top: '8%', left: '-100px' }} aria-hidden="true" />
      <div className="aurora" style={{ width: 360, height: 360, bottom: '6%', right: '-80px', animationDelay: '-6s' }} aria-hidden="true" />
      <div className="login-card">
        <div className="wsbrand" style={{ paddingBottom: 14 }}>
          <img src="/corble-logo-dark.png" alt="Corble" width={574} height={192} />
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-1px', background: 'linear-gradient(100deg,#fff 35%,#b5a2ff)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Workspace</span>
        </div>
        <h1>Sign in to Corble</h1>
        <p className="sub">Accounts are created by an admin in Workspace → Team.</p>
        <Suspense fallback={<button className="btn primary" disabled style={{ width: '100%', justifyContent: 'center' }}>Loading…</button>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
