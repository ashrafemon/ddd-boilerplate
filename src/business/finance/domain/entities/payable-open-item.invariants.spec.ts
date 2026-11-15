import { PayableOpenItemInvariants } from './payable-open-item.invariants';

const dueDate = new Date('2026-02-01');

describe('PayableOpenItemInvariants', () => {
  it('accepts a valid open item', () => {
    expect(() =>
      PayableOpenItemInvariants.enforcePayableOpenItemCreate('v1', 'b1', 100, dueDate),
    ).not.toThrow();
  });

  it('requires a vendor id', () => {
    expect(() =>
      PayableOpenItemInvariants.enforcePayableOpenItemCreate('', 'b1', 100, dueDate),
    ).toThrow('Vendor ID is required');
  });

  it('requires a vendor bill id', () => {
    expect(() =>
      PayableOpenItemInvariants.enforcePayableOpenItemCreate('v1', '', 100, dueDate),
    ).toThrow('Vendor bill ID is required');
  });

  it('requires a positive amount', () => {
    expect(() =>
      PayableOpenItemInvariants.enforcePayableOpenItemCreate('v1', 'b1', 0, dueDate),
    ).toThrow('Payable open item amount must be positive');
    expect(() =>
      PayableOpenItemInvariants.enforcePayableOpenItemCreate('v1', 'b1', -1, dueDate),
    ).toThrow('Payable open item amount must be positive');
  });

  it('requires a valid due date', () => {
    expect(() =>
      PayableOpenItemInvariants.enforcePayableOpenItemCreate('v1', 'b1', 100, new Date('nope')),
    ).toThrow('Due date is required');
  });
});
