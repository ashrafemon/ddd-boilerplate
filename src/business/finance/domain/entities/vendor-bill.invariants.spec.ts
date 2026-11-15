import { VendorBillInvariants } from './vendor-bill.invariants';
import { VendorBillStatus } from '../types/finance.enum';

const dueDate = new Date('2026-02-01');

describe('VendorBillInvariants', () => {
  it('accepts a valid bill', () => {
    expect(() =>
      VendorBillInvariants.enforceVendorBillCreate('BILL-1', 'v1', 100, dueDate),
    ).not.toThrow();
  });

  it('requires a bill number', () => {
    expect(() => VendorBillInvariants.enforceVendorBillCreate('', 'v1', 100, dueDate)).toThrow(
      'Vendor bill number is required',
    );
  });

  it('requires a vendor id', () => {
    expect(() => VendorBillInvariants.enforceVendorBillCreate('BILL-1', '', 100, dueDate)).toThrow(
      'Vendor ID is required',
    );
  });

  it('requires a positive amount', () => {
    expect(() => VendorBillInvariants.enforceVendorBillCreate('BILL-1', 'v1', 0, dueDate)).toThrow(
      'Vendor bill amount must be positive',
    );
  });

  it('requires a due date', () => {
    expect(() =>
      VendorBillInvariants.enforceVendorBillCreate('BILL-1', 'v1', 100, new Date('nope')),
    ).toThrow('Due date is required');
  });

  it.each([
    [VendorBillStatus.DRAFT, VendorBillStatus.POSTED],
    [VendorBillStatus.DRAFT, VendorBillStatus.CANCELLED],
    [VendorBillStatus.POSTED, VendorBillStatus.PAID],
  ])('allows %s -> %s', (from, to) => {
    expect(() => VendorBillInvariants.enforceVendorBillStatusTransition(from, to)).not.toThrow();
  });

  it('rejects CANCELLED -> POSTED', () => {
    expect(() =>
      VendorBillInvariants.enforceVendorBillStatusTransition(
        VendorBillStatus.CANCELLED,
        VendorBillStatus.POSTED,
      ),
    ).toThrow('Invalid vendor bill transition');
  });
});
