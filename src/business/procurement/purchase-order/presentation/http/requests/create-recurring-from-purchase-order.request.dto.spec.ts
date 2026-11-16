import { CreateRecurringFromPurchaseOrderDto } from './create-recurring-from-purchase-order.request.dto';

describe('CreateRecurringFromPurchaseOrderDto schema', () => {
  it('accepts a TIME schedule', () => {
    expect(
      CreateRecurringFromPurchaseOrderDto.schema.safeParse({
        triggerType: 'TIME',
        frequency: 'MONTHLY',
        interval: 1,
        startDate: '2026-01-01',
      }).success,
    ).toBe(true);
  });

  it('rejects a TIME schedule without frequency', () => {
    expect(
      CreateRecurringFromPurchaseOrderDto.schema.safeParse({
        triggerType: 'TIME',
        interval: 1,
        startDate: '2026-01-01',
      }).success,
    ).toBe(false);
  });

  it('rejects an EVENT schedule without eventName', () => {
    expect(
      CreateRecurringFromPurchaseOrderDto.schema.safeParse({ triggerType: 'EVENT' }).success,
    ).toBe(false);
  });
});
