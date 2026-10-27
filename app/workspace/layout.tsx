import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Shell from './Shell';

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const userId = session.user.id;
  // Read-first: avoid a write on every request (the settings row is seeded as 'global').
  const [user, settings] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, role: true, theme: true, email: true } }),
    (async () => {
      const existing = await db.settings.findUnique({ where: { id: 'global' } });
      return existing ?? db.settings.create({ data: { id: 'global' } });
    })(),
  ]);
  if (!user) redirect('/login');

  return (
    <Shell
      user={{ name: user.name, email: user.email, role: user.role, theme: user.theme }}
      companyName={settings.companyName}
      currency={settings.currency}
    >
      {children}
    </Shell>
  );
}
