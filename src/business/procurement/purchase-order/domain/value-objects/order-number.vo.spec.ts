import { OrderNumber } from './order-number.vo';

describe('OrderNumber', () => {
  it('normalizes trimmed value and upper-cases input', () => {
    const orderNumber = OrderNumber.create('  PO-00001234  ');
    expect(orderNumber.value).toBe('PO-00001234');
  });

  it('generates padded order number', () => {
    expect(OrderNumber.generate(7).value).toBe('PO-00000007');
  });

  it('rejects invalid format', () => {
    expect(() => OrderNumber.create('po-1')).toThrow('Order number must match PO-<identifier>');
  });
});
