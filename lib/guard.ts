// Server-side identity resolution for API routes: role + isActive always come from the
// database, never from JWT claims (which may outlive a deactivation or role change).
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export type DbSessionUser = { id: string; role: 'ADMIN' | 'MEMBER'; name: string };

export async function dbUser(): Promise<DbSessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { id: true, role: true, name: true, isActive: true },
  });
  if (!u || !u.isActive) return null;
  return { id: u.id, role: u.role, name: u.name ?? '' };
}
