import { CreatePurchaseOrderMobileResponseDto } from './create-purchase-order.mobile.response.dto';

describe('CreatePurchaseOrderMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() => CreatePurchaseOrderMobileResponseDto.schema.parse({ id: 'po-1' })).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => CreatePurchaseOrderMobileResponseDto.schema.parse({})).toThrow();
  });
});
