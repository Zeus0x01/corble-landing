// Dev-only demo-user reset. Refuses to run in production.
// Usage: npx tsx scripts/reset-demo-users.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset demo users in production. Reset real users from /workspace/team instead.');
  }
  const rawPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!rawPassword || rawPassword === 'change-me-dev-only') {
    throw new Error('Set SEED_ADMIN_PASSWORD in .env before resetting demo users.');
  }
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const result = await prisma.user.updateMany({
    where: { email: { endsWith: '@corble.net' } },
    data: { passwordHash, isActive: true },
  });
  console.log(`Reset ${result.count} demo user(s) to the password from SEED_ADMIN_PASSWORD (dev only).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
