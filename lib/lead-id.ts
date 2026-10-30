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
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) codes.push(await allocateLeadCode(tx));
  return codes;
}
