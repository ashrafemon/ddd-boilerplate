import { PrismaClient } from '../../../generated/client';

/**
 * Platform read-connection port. Query repositories in business modules read
 * through this token instead of importing the infrastructure Prisma client, so
 * the replica connection (pool sizing, driver, read/write split) stays an
 * infrastructure detail.
 *
 * It extends the generated client purely for typing: only the infrastructure
 * adapter (`PrismaReadService`) is ever instantiated and bound to it.
 */
export abstract class PrismaReadPort extends PrismaClient {}
