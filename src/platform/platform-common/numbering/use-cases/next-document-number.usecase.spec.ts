import { NextDocumentNumberUseCase } from './next-document-number.usecase';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';

describe('NextDocumentNumberUseCase', () => {
  function makeSut() {
    const increment = jest.fn<
      Promise<{ prefix: string; padding: number; currentValue: bigint }>,
      [string, { prefix: string; padding: number }]
    >(async () => ({ prefix: 'PO-', padding: 0, currentValue: 1n }));
    const sequences = { increment };
    const requestContext = { get: jest.fn(() => ({ companyId: 'company-1' })) };
    const useCase = new NextDocumentNumberUseCase(
      sequences,
      requestContext as unknown as RequestContextPort,
    );
    return { useCase, sequences, requestContext };
  }

  it('scopes the series by the effective company', async () => {
    const { useCase, sequences } = makeSut();

    await useCase.execute('purchase-order');

    expect(sequences.increment.mock.calls[0][0]).toContain('company-1:purchase-order');
  });

  it('formats the number with the stored prefix and zero padding', async () => {
    const { useCase, sequences } = makeSut();
    sequences.increment.mockResolvedValue({ prefix: 'PO-', padding: 6, currentValue: 42n });

    await expect(useCase.execute('purchase-order')).resolves.toBe('PO-000042');
  });

  it('formats an unpadded series without leading zeros', async () => {
    const { useCase, sequences } = makeSut();
    sequences.increment.mockResolvedValue({ prefix: 'GRN-', padding: 0, currentValue: 7n });

    await expect(useCase.execute('grn')).resolves.toBe('GRN-7');
  });

  it('resolves a missing prefix to the empty string', async () => {
    const { useCase, sequences } = makeSut();

    await useCase.execute('invoice');

    expect(sequences.increment.mock.calls[0][1]).toEqual({ prefix: '', padding: 0 });
  });

  it('formats values beyond 2^53 without precision loss', async () => {
    const { useCase, sequences } = makeSut();
    sequences.increment.mockResolvedValue({
      prefix: '',
      padding: 0,
      currentValue: 9007199254740993n,
    });

    await expect(useCase.execute('invoice')).resolves.toBe('9007199254740993');
  });
});
