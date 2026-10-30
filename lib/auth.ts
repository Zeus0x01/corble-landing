import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { loginSchema } from '@/lib/validators';
import { rateLimit, clearRateLimit, pruneRateLimits } from '@/lib/ratelimit';

// Login rate limiting (D6): DB-backed so it holds across serverless instances.
// Keys include the request IP — an attacker cannot lock a specific admin account
// by spoofing a known email, because only their own IP bucket trips.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_EMAIL_IP = 10;
const MAX_PER_IP = 25;

function clientIp(headers: Headers | null): string {
  if (!headers) return 'unknown';
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (raw, req) => {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const ip = clientIp((req as Request | undefined)?.headers ?? null);
        void pruneRateLimits();
        const emailBucket = `login:email:${parsed.data.email.toLowerCase()}:ip:${ip}`;
        const ipBucket = `login:ip:${ip}`;
        if (!(await rateLimit(emailBucket, MAX_PER_EMAIL_IP, WINDOW_MS))) return null;
        if (!(await rateLimit(ipBucket, MAX_PER_IP, WINDOW_MS))) return null;

        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;
        if (!user.isActive) return null;

        await Promise.all([clearRateLimit(emailBucket), clearRateLimit(ipBucket)]);
        return { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? 'MEMBER';
        token.id = (user as { id?: string }).id ?? '';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as 'ADMIN' | 'MEMBER';
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
