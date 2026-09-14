import { FieldResolverRegistry } from './field-resolver.registry';
import { EvaluationContext, FieldResolver } from './ports/field-resolver.port';

class FakeFieldResolver implements FieldResolver {
  resolve(field: string, context: EvaluationContext): Promise<unknown> {
    return Promise.resolve(`${field}@${context.tenantId}`);
  }
}

describe('FieldResolverRegistry', () => {
  let registry: FieldResolverRegistry;

  beforeEach(() => {
    registry = new FieldResolverRegistry();
  });

  it('routes a dotted field to the resolver registered under its prefix', async () => {
    registry.register('invoice', new FakeFieldResolver());
    await expect(
      registry.resolve('invoice.status', { tenantId: 't1', traceId: 'tr1' }),
    ).resolves.toBe('invoice.status@t1');
  });

  it('throws the same /No FieldResolver registered/ for an unresolved prefix', () => {
    expect(() => registry.resolve('stock_balance.qty', { traceId: 'tr1' })).toThrow(
      /No FieldResolver registered/,
    );
  });

  it('rejects duplicate prefixes at boot with the legacy message', () => {
    registry.register('invoice', new FakeFieldResolver());
    expect(() => registry.register('invoice', new FakeFieldResolver())).toThrow(
      "FieldResolver for 'invoice' already registered",
    );
    expect(registry.has('invoice')).toBe(true);
    expect(registry.registeredKeys()).toEqual(['invoice']);
  });
});
