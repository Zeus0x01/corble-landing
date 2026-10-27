import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const baseClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = baseClient;

/**
 * Serverless + pooled Postgres (Supabase pooler behind Vercel) can fail to
 * acquire a connection on cold starts. These Prisma codes mean the statement
 * never reached the server (connection acquisition/init stage), so transparent
 * retries are safe — even for writes.
 */
const ACQUISITION_CODES = new Set(['P1001', 'P1002', 'P1017', 'P2024']);

function isAcquisitionFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && ACQUISITION_CODES.has(error.code)
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRY_EXTENSIONS = {
  $allModels: {
    async $allOperations({ operation, args, query }: {
      operation: string;
      args: unknown;
      query: (args: unknown) => Promise<unknown>;
    }) {
      const maxAttempts = 3;
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await query(args);
        } catch (error) {
          lastError = error;
          // Acquisition failures happen before execution → always retry.
          // Other failures: retry only reads (mutations may have applied).
          const isRead = ['findUnique', 'findFirst', 'findMany', 'aggregate', 'groupBy', 'count'].includes(operation);
          if (!isAcquisitionFailure(error) && !isRead) throw error;
          if (attempt === maxAttempts) throw error;
          await delay(150 * attempt);
        }
      }
      throw lastError;
    },
  },
};

export const db = baseClient.$extends({
  query: RETRY_EXTENSIONS,
}) as unknown as PrismaClient;

export type Db = typeof db;
