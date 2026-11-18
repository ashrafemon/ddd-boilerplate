import { faker } from '@faker-js/faker';

/**
 * Deterministic fixtures for seeds and tests.
 *
 * Always seed faker before generating: the same seed must produce the same
 * fixtures, otherwise a re-run of `npm run db:seed` would create different
 * numbers and break reproducible integration runs.
 */
export const FIXTURE_SEED = 20260101;

export function seedFaker(seed: number = FIXTURE_SEED): void {
  faker.seed(seed);
}

/** Zero-padded business code: `SKU-0001`, `VEN-0001`. */
export function sequenceCode(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(4, '0')}`;
}
