import { SkuInvariants } from './sku.invariants';

describe('SkuInvariants', () => {
  it('accepts a valid SKU', () => {
    expect(() => SkuInvariants.enforceSkuFormat('SKU-001')).not.toThrow();
  });

  it('accepts a lower-case SKU', () => {
    expect(() => SkuInvariants.enforceSkuFormat('sku-001')).not.toThrow();
  });

  it('rejects an empty SKU', () => {
    expect(() => SkuInvariants.enforceSkuFormat('   ')).toThrow('SKU cannot be empty');
  });

  it('rejects a too-short SKU', () => {
    expect(() => SkuInvariants.enforceSkuFormat('A')).toThrow('SKU must be 2-64 chars');
  });

  it('rejects a too-long SKU', () => {
    expect(() => SkuInvariants.enforceSkuFormat('A'.repeat(65))).toThrow('SKU must be 2-64 chars');
  });

  it('rejects illegal characters', () => {
    expect(() => SkuInvariants.enforceSkuFormat('SKU 001')).toThrow('SKU must be 2-64 chars');
    expect(() => SkuInvariants.enforceSkuFormat('SKU_001')).toThrow('SKU must be 2-64 chars');
  });
});
