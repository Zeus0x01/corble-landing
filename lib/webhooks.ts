import { createHash, randomBytes } from 'crypto';

export function createWebhookSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function webhookSecretHash(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function webhookUrl(origin: string, secret: string): string {
  return `${origin.replace(/\/$/, '')}/api/webhooks/incoming/${encodeURIComponent(secret)}`;
}
