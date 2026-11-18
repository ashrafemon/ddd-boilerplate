import { NumberingAdapter } from './numbering.adapter';
import { NextDocumentNumberUseCase } from '../../use-cases/next-document-number.usecase';
import { NextNumberOptions } from '../ports/numbering.port';

describe('NumberingAdapter', () => {
  it('delegates to the use case and forwards the options', async () => {
    const nextDocumentNumber = {
      execute: jest.fn<Promise<string>, [string, NextNumberOptions?]>(async () => 'PO-000001'),
    };
    const adapter = new NumberingAdapter(
      nextDocumentNumber as unknown as NextDocumentNumberUseCase,
    );

    await expect(adapter.nextNumber('purchase-order', { prefix: 'PO-', padding: 6 })).resolves.toBe(
      'PO-000001',
    );
    expect(nextDocumentNumber.execute.mock.calls[0]).toEqual([
      'purchase-order',
      { prefix: 'PO-', padding: 6 },
    ]);
  });

  it('passes no options when the caller omits them', async () => {
    const nextDocumentNumber = {
      execute: jest.fn<Promise<string>, [string, NextNumberOptions?]>(async () => 'INV-1'),
    };
    const adapter = new NumberingAdapter(
      nextDocumentNumber as unknown as NextDocumentNumberUseCase,
    );

    await adapter.nextNumber('invoice');

    expect(nextDocumentNumber.execute.mock.calls[0][1]).toBeUndefined();
  });
});
