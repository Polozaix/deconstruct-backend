import { PrismaClient } from '@prisma/client';

/**
 * A single shared Prisma client for the process. Prisma connects lazily on the
 * first query, so importing this module is safe in tests.
 */
export const prisma = new PrismaClient();

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

/** Lightweight readiness probe. */
export async function pingDb(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
