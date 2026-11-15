import { ProductNameInvariants } from './product-name.invariants';

describe('ProductNameInvariants', () => {
  it('accepts a valid name', () => {
    expect(() => ProductNameInvariants.enforceProductName('Wireless Mouse')).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => ProductNameInvariants.enforceProductName('   ')).toThrow(
      'Product name cannot be empty',
    );
  });

  it('rejects a name over 200 characters', () => {
    expect(() => ProductNameInvariants.enforceProductName('A'.repeat(201))).toThrow(
      'Product name cannot exceed 200 characters',
    );
  });

  it('accepts exactly 200 characters', () => {
    expect(() => ProductNameInvariants.enforceProductName('A'.repeat(200))).not.toThrow();
  });
});
