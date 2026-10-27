import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Shell from './Shell';
import Sidebar from '@/components/Sidebar';

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const userId = session.user.id;
  const [user, settings] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, role: true, theme: true, email: true } }),
    db.settings.upsert({ where: { id: 'global' }, update: {}, create: { id: 'global' } }),
  ]);
  if (!user) redirect('/login');

  return (
    <Shell
      user={{ name: user.name, email: user.email, role: user.role, theme: user.theme }}
      companyName={settings.companyName}
      currency={settings.currency}
    >
      <Sidebar role={user.role} />
      {children}
    </Shell>
  );
}
