import { ConditionEvaluationService } from './condition-evaluation.service';
import { FieldResolverRegistry } from './field-resolver.registry';
import { UnregisteredFieldError } from './errors/unregistered-field.error';
import { EvaluationContext, FieldResolver } from './ports/field-resolver.port';

class FakeFieldResolver implements FieldResolver {
  constructor(private readonly values: Record<string, unknown>) {}

  resolve(field: string): Promise<unknown> {
    return Promise.resolve(this.values[field]);
  }
}

function makeContext(): EvaluationContext {
  return { traceId: 'trace-1' };
}

describe('ConditionEvaluationService', () => {
  let registry: FieldResolverRegistry;
  let service: ConditionEvaluationService;

  beforeEach(() => {
    registry = new FieldResolverRegistry();
    registry.register(
      'invoice',
      new FakeFieldResolver({ 'invoice.status': 'UNPAID', 'invoice.amount': 150 }),
    );
    service = new ConditionEvaluationService(registry);
  });

  it('passes an AND condition when every clause matches', async () => {
    const result = await service.evaluate(
      {
        logic: 'AND',
        clauses: [
          { field: 'invoice.status', operator: 'eq', value: 'UNPAID' },
          { field: 'invoice.amount', operator: 'gte', value: 100 },
        ],
      },
      makeContext(),
    );

    expect(result.passed).toBe(true);
    expect(result.evaluatedValues).toEqual({ 'invoice.status': 'UNPAID', 'invoice.amount': 150 });
  });

  it('fails an AND condition when one clause does not match', async () => {
    const result = await service.evaluate(
      {
        logic: 'AND',
        clauses: [
          { field: 'invoice.status', operator: 'eq', value: 'UNPAID' },
          { field: 'invoice.amount', operator: 'gt', value: 1000 },
        ],
      },
      makeContext(),
    );

    expect(result.passed).toBe(false);
  });

  it('passes an OR condition when at least one clause matches', async () => {
    const result = await service.evaluate(
      {
        logic: 'OR',
        clauses: [
          { field: 'invoice.status', operator: 'eq', value: 'PAID' },
          { field: 'invoice.amount', operator: 'lt', value: 1000 },
        ],
      },
      makeContext(),
    );

    expect(result.passed).toBe(true);
  });

  it('supports in/notIn operators', async () => {
    const inResult = await service.evaluate(
      {
        logic: 'AND',
        clauses: [{ field: 'invoice.status', operator: 'in', value: ['UNPAID', 'OVERDUE'] }],
      },
      makeContext(),
    );
    expect(inResult.passed).toBe(true);

    const notInResult = await service.evaluate(
      { logic: 'AND', clauses: [{ field: 'invoice.status', operator: 'notIn', value: ['PAID'] }] },
      makeContext(),
    );
    expect(notInResult.passed).toBe(true);
  });

  it('throws UnregisteredFieldError for an unknown field prefix, distinct from a false clause', async () => {
    await expect(
      service.evaluate(
        {
          logic: 'AND',
          clauses: [{ field: 'stock_balance.qtyOnHand', operator: 'lt', value: 10 }],
        },
        makeContext(),
      ),
    ).rejects.toBeInstanceOf(UnregisteredFieldError);
  });
});
