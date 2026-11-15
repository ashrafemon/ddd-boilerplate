import { VendorBillPolicy } from './vendor-bill.policy';
import { VendorBillStatus } from '../types/finance.enum';

describe('VendorBillPolicy', () => {
  it('allows posting a DRAFT bill with a positive amount', () => {
    expect(() =>
      VendorBillPolicy.enforceVendorBillPostAllowed(VendorBillStatus.DRAFT, 100),
    ).not.toThrow();
  });

  it('rejects a non-positive amount', () => {
    expect(() => VendorBillPolicy.enforceVendorBillPostAllowed(VendorBillStatus.DRAFT, 0)).toThrow(
      'Vendor bill amount must be positive to post',
    );
  });

  it('rejects a non-draft bill', () => {
    expect(() =>
      VendorBillPolicy.enforceVendorBillPostAllowed(VendorBillStatus.POSTED, 100),
    ).toThrow('Cannot post vendor bill in status POSTED');
  });
});
