// Shared, DB-backed rate limiter (D6). In-memory Maps lose state across serverless
// instances and restarts; every instance must see the same window for the limit to
// mean anything. Uses a tiny RateLimit table keyed by string; upserts do the counting.
import { db } from '@/lib/db';

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterMs: number };

export async function rateLimit(key: string, limit = 60, windowMs = 60_000): Promise<boolean> {
  return (await rateLimitInfo(key, limit, windowMs)).ok;
}

export async function rateLimitInfo(key: string, limit = 60, windowMs = 60_000): Promise<RateLimitResult> {
  const now = new Date();
  const start = new Date(now.getTime() - windowMs);
  try {
    const hit = await db.rateLimit.findUnique({ where: { key } });
    if (!hit || hit.windowStart <= start) {
      await db.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
    }
    if (hit.count >= limit) {
      return { ok: false, remaining: 0, retryAfterMs: Math.max(0, hit.windowStart.getTime() + windowMs - now.getTime()) };
    }
    await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { ok: true, remaining: limit - hit.count - 1, retryAfterMs: 0 };
  } catch {
    // Never block legitimate traffic because the limiter table is unavailable.
    return { ok: true, remaining: 0, retryAfterMs: 0 };
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  try {
    await db.rateLimit.delete({ where: { key } });
  } catch {
    // ignore
  }
}

let lastPrune = 0;
// Opportunistic cleanup: old windows are worthless rows. Runs at most once per
// 10 minutes on whichever instance hits it.
export async function pruneRateLimits(): Promise<void> {
  const now = Date.now();
  if (now - lastPrune < 10 * 60 * 1000) return;
  lastPrune = now;
  try {
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now - 30 * 60 * 1000) } } });
  } catch {
    // ignore
  }
}
