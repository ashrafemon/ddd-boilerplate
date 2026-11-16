import { GrnBatchOperationAdapter } from './grn-batch-operation.adapter';
import { GetGrnUseCase } from '../../../application/use-cases/get-grn.usecase';
import { ReceiveGrnUseCase } from '../../../application/use-cases/receive-grn.usecase';
import { PostGrnUseCase } from '../../../application/use-cases/post-grn.usecase';

describe('GrnBatchOperationAdapter', () => {
  const get = { execute: jest.fn() };
  const receive = { execute: jest.fn() };
  const post = { execute: jest.fn() };
  let adapter: GrnBatchOperationAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new GrnBatchOperationAdapter(
      get as unknown as GetGrnUseCase,
      receive as unknown as ReceiveGrnUseCase,
      post as unknown as PostGrnUseCase,
    );
  });

  it('exposes the supported operations', () => {
    expect(adapter.aggregateType()).toBe('GoodReceiptNote');
    expect(adapter.supportedOperations()).toEqual(['receive', 'complete']);
  });

  it('rejects an unknown GRN', async () => {
    get.execute.mockResolvedValue(null);
    await expect(adapter.validate('grn-1', 'receive')).resolves.toEqual({
      canProceed: false,
      reason: 'Goods receipt not found',
    });
  });

  it('rejects an invalid source status', async () => {
    get.execute.mockResolvedValue({ status: 'RECEIVED' });
    await expect(adapter.validate('grn-1', 'receive')).resolves.toMatchObject({
      canProceed: false,
    });
  });

  it('executes receive and returns a snapshot', async () => {
    get.execute
      .mockResolvedValueOnce({ status: 'DRAFT' })
      .mockResolvedValueOnce({ status: 'RECEIVED' });
    await expect(adapter.execute('grn-1', 'receive')).resolves.toEqual({
      resultSnapshot: { transition: 'receive', statusBefore: 'DRAFT', statusAfter: 'RECEIVED' },
    });
    expect(receive.execute).toHaveBeenCalledWith({ id: 'grn-1' });
  });

  it('executes complete through the post use case', async () => {
    get.execute.mockResolvedValue({ status: 'RECEIVED' });
    await adapter.execute('grn-1', 'complete');
    expect(post.execute).toHaveBeenCalledWith({ id: 'grn-1' });
  });

  it('throws for an unsupported operation', async () => {
    get.execute.mockResolvedValue({ status: 'DRAFT' });
    await expect(adapter.execute('grn-1', 'archive')).rejects.toThrow(
      "Unsupported GRN batch operation 'archive'",
    );
  });
});
