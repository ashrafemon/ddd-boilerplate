import { faker } from '@faker-js/faker';
import { sequenceCode } from './seed';

export interface ProductFixture {
  sku: string;
  name: string;
  description: string;
  unitPrice: string;
  currency: string;
}

/** One product row; every field can be overridden for a specific case. */
export function makeProduct(overrides: Partial<ProductFixture> = {}): ProductFixture {
  const product: ProductFixture = {
    sku: sequenceCode('SKU', 0),
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    unitPrice: faker.commerce.price({ min: 1, max: 500, dec: 2 }),
    currency: 'USD',
  };
  return { ...product, ...overrides };
}

/** A batch with stable, unique SKUs (safe for upserts on the natural key). */
export function makeProducts(count: number): ProductFixture[] {
  return Array.from({ length: count }, (_, index) =>
    makeProduct({
      sku: sequenceCode('SKU', index),
      unitPrice: faker.commerce.price({ min: 1, max: 500, dec: 2 }),
    }),
  );
}
