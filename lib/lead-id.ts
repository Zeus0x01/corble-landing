import type { Prisma } from '@prisma/client';

type LeadIdClient = Pick<Prisma.TransactionClient, 'leadIdSequence'>;

export async function allocateLeadCode(tx: LeadIdClient): Promise<string> {
  const sequence = await tx.leadIdSequence.update({
    where: { id: 1 },
    data: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  return `LEAD-${String(sequence.nextValue - 1).padStart(6, '0')}`;
}

export async function allocateLeadCodes(tx: LeadIdClient, count: number): Promise<string[]> {
  if (count <= 0) return [];
  const sequence = await tx.leadIdSequence.update({
    where: { id: 1 },
    data: { nextValue: { increment: count } },
    select: { nextValue: true },
  });
  const firstValue = sequence.nextValue - count;
  return Array.from({ length: count }, (_, index) => `LEAD-${String(firstValue + index).padStart(6, '0')}`);
}
