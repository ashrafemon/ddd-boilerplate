import { faker } from '@faker-js/faker';
import { sequenceCode } from './seed';

export interface VendorFixture {
  code: string;
  name: string;
  email: string;
}

/** One vendor row; every field can be overridden for a specific case. */
export function makeVendor(overrides: Partial<VendorFixture> = {}): VendorFixture {
  const vendor: VendorFixture = {
    code: sequenceCode('VEN', 0),
    name: faker.company.name(),
    email: faker.internet.email().toLowerCase(),
  };
  return { ...vendor, ...overrides };
}

/** A batch with stable, unique codes (safe for upserts on the natural key). */
export function makeVendors(count: number): VendorFixture[] {
  return Array.from({ length: count }, (_, index) =>
    makeVendor({ code: sequenceCode('VEN', index) }),
  );
}
