import { CreateRecurringPurchaseOrderDto } from './create-recurring-purchase-order.request.dto';

const base = {
  name: 'Monthly PO',
  vendorId: '550e8400-e29b-41d4-a716-446655440000',
  triggerType: 'TIME' as const,
  frequency: 'MONTHLY' as const,
  interval: 1,
  startDate: '2026-01-01',
  lines: [{ productId: '550e8400-e29b-41d4-a716-446655440000', quantity: 2, unitPrice: 5 }],
};

describe('CreateRecurringPurchaseOrderDto schema', () => {
  it('accepts a complete recurring order', () => {
    expect(CreateRecurringPurchaseOrderDto.schema.safeParse(base).success).toBe(true);
  });

  it('rejects an empty line set', () => {
    expect(CreateRecurringPurchaseOrderDto.schema.safeParse({ ...base, lines: [] }).success).toBe(
      false,
    );
  });

  it('rejects a missing vendor', () => {
    expect(
      CreateRecurringPurchaseOrderDto.schema.safeParse({ ...base, vendorId: undefined }).success,
    ).toBe(false);
  });
});
