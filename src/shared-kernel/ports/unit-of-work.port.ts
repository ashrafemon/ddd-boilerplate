/**
 * Transactional boundary abstraction. The application layer runs unit-of-work
 * blocks through this port; infrastructure provides a Prisma-backed adapter so
 * aggregate persistence + outbox writes commit atomically.
 */
export interface UnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
