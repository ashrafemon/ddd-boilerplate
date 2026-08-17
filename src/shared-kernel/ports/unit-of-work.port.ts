/**
 * Transactional boundary abstraction. The application layer runs unit-of-work
 * blocks through this port; infrastructure provides a Prisma-backed adapter so
 * aggregate persistence + outbox writes commit atomically.
 */
export abstract class UnitOfWork {
  abstract execute<T>(work: () => Promise<T>): Promise<T>;
}
