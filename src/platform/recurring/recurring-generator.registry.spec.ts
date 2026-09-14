import { RecurringGeneratorRegistry } from './recurring-generator.registry';
import { RecurringGenerator } from './ports/recurring-generator.port';

const generator = (): RecurringGenerator => ({
  resolveHeader: jest.fn(),
  generate: jest.fn(),
});

describe('RecurringGeneratorRegistry', () => {
  let registry: RecurringGeneratorRegistry;

  beforeEach(() => {
    registry = new RecurringGeneratorRegistry();
  });

  it('resolves the generator registered for a targetEntityType', () => {
    const invoiceGenerator = generator();
    registry.register('Invoice', invoiceGenerator);
    expect(registry.resolve('Invoice')).toBe(invoiceGenerator);
    expect(registry.has('Invoice')).toBe(true);
    expect(registry.registeredKeys()).toEqual(['Invoice']);
  });

  it('rejects duplicate registrations at boot', () => {
    registry.register('Invoice', generator());
    expect(() => registry.register('Invoice', generator())).toThrow(/already registered/);
  });

  it('throws for a targetEntityType without a generator', () => {
    expect(() => registry.resolve('Bill')).toThrow(/No RecurringGenerator registered/);
  });
});
