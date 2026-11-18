import { ConfigService } from '@config/config.service';
import { ReceiveInboxMessageUseCase } from './receive-inbox-message.usecase';
import { InboxRepositoryPort } from '../outbound/ports/inbox.repository.port';
import { InboxMessage, InboxReceiveRequest } from '../types/inbox.types';

/**
 * Unit — first delivery vs duplicate vs in-flight vs retry.
 *
 * The four outcomes are the whole consumer contract: only ACQUIRED may run the
 * listener, DUPLICATE must return silently, BUSY must return without touching
 * business state. Also pins the payload-mismatch guard and the CAS race.
 */

const REQUEST: InboxReceiveRequest = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  consumer: 'goods_receipt',
  messageId: 'evt-1',
  messageType: 'inventory.grn.created',
  payload: { grnId: 'grn-1' },
  correlationId: 'corr-1',
};

const CONFIG = {
  claimLeaseMs: 60_000,
  maxAttempts: 5,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 600_000,
  reconciliationIntervalMs: 60_000,
  processedRetentionMs: 30 * 24 * 60 * 60 * 1000,
};

function existingRow(overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id: 'row-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    consumer: 'goods_receipt',
    messageId: 'evt-1',
    messageType: 'inventory.grn.created',
    eventVersion: 1,
    payload: { grnId: 'grn-1' },
    payloadHash: null,
    status: 'IN_PROGRESS',
    attempts: 1,
    claimToken: 'claim-old',
    claimedAt: new Date(),
    processedAt: null,
    nextAttemptAt: null,
    lastError: null,
    correlationId: null,
    causationId: null,
    ...overrides,
  };
}

function makeSut() {
  const insertIfAbsent = jest.fn<Promise<{ id: string } | null>, [never]>();
  insertIfAbsent.mockResolvedValue({ id: 'row-1' });
  const findUnique = jest.fn<Promise<InboxMessage | null>, [never]>();
  findUnique.mockResolvedValue(null);
  const reclaim = jest.fn<Promise<boolean>, [string, string, string, Date]>();
  reclaim.mockResolvedValue(true);
  const markPermanentlyFailed = jest.fn<Promise<boolean>, [string, string, string | null]>();
  markPermanentlyFailed.mockResolvedValue(true);

  const repository = {
    insertIfAbsent,
    findUnique,
    reclaim,
    markPermanentlyFailed,
  } as unknown as InboxRepositoryPort;
  const config = { getInbox: () => CONFIG } as unknown as ConfigService;

  return {
    useCase: new ReceiveInboxMessageUseCase(repository, config),
    insertIfAbsent,
    findUnique,
    reclaim,
    markPermanentlyFailed,
  };
}

describe('ReceiveInboxMessageUseCase', () => {
  it('claims a first delivery and returns a reservation', async () => {
    const { useCase, insertIfAbsent } = makeSut();

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('ACQUIRED');
    const input = insertIfAbsent.mock.calls[0][0] as unknown as {
      identity: Record<string, string>;
      messageType: string;
      eventVersion: number;
      payloadHash: string;
    };
    expect(input.identity).toEqual({
      tenantId: 'tenant-1',
      companyId: 'company-1',
      consumer: 'goods_receipt',
      messageId: 'evt-1',
    });
    expect(input.messageType).toBe('inventory.grn.created');
    expect(input.eventVersion).toBe(1);
    expect(input.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns DUPLICATE for a processed message', async () => {
    const { useCase, insertIfAbsent, findUnique, reclaim } = makeSut();
    insertIfAbsent.mockResolvedValue(null);
    findUnique.mockResolvedValue(existingRow({ status: 'PROCESSED' }));

    await expect(useCase.execute(REQUEST)).resolves.toEqual({ status: 'DUPLICATE' });
    expect(reclaim).not.toHaveBeenCalled();
  });

  it('returns BUSY while another consumer holds a live claim', async () => {
    const { useCase, insertIfAbsent, findUnique, reclaim } = makeSut();
    insertIfAbsent.mockResolvedValue(null);
    findUnique.mockResolvedValue(existingRow({ claimedAt: new Date() }));

    await expect(useCase.execute(REQUEST)).resolves.toEqual({ status: 'BUSY' });
    expect(reclaim).not.toHaveBeenCalled();
  });

  it('returns BUSY when the retry backoff has not elapsed', async () => {
    const { useCase, insertIfAbsent, findUnique, reclaim } = makeSut();
    insertIfAbsent.mockResolvedValue(null);
    findUnique.mockResolvedValue(
      existingRow({
        claimedAt: new Date(Date.now() - 120_000),
        nextAttemptAt: new Date(Date.now() + 60_000),
      }),
    );

    await expect(useCase.execute(REQUEST)).resolves.toEqual({ status: 'BUSY' });
    expect(reclaim).not.toHaveBeenCalled();
  });

  it('re-claims an expired lease and keeps the same row identity', async () => {
    const { useCase, insertIfAbsent, findUnique, reclaim } = makeSut();
    insertIfAbsent.mockResolvedValue(null);
    findUnique.mockResolvedValue(
      existingRow({ claimedAt: new Date(Date.now() - 120_000), claimToken: 'claim-old' }),
    );

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('ACQUIRED');
    if (result.status !== 'ACQUIRED') return;
    expect(result.reservation.id).toBe('row-1');
    expect(reclaim).toHaveBeenCalledWith(
      'row-1',
      'claim-old',
      result.reservation.claimToken,
      expect.any(Date),
    );
  });

  it('returns BUSY when it loses the re-claim race', async () => {
    const { useCase, insertIfAbsent, findUnique, reclaim } = makeSut();
    insertIfAbsent.mockResolvedValue(null);
    findUnique.mockResolvedValue(existingRow({ claimedAt: new Date(Date.now() - 120_000) }));
    reclaim.mockResolvedValue(false);

    await expect(useCase.execute(REQUEST)).resolves.toEqual({ status: 'BUSY' });
  });

  it('parks a payload mismatch as FAILED instead of re-executing', async () => {
    const { useCase, insertIfAbsent, findUnique, markPermanentlyFailed } = makeSut();
    insertIfAbsent.mockResolvedValue(null);
    findUnique.mockResolvedValue(
      existingRow({ claimedAt: new Date(Date.now() - 120_000), payloadHash: 'hash-of-old' }),
    );

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('BUSY');
    expect(markPermanentlyFailed).toHaveBeenCalledWith(
      'row-1',
      'claim-old',
      expect.stringContaining('payload-mismatch'),
    );
  });

  it('returns BUSY for a suspended message rather than retrying it', async () => {
    const { useCase, insertIfAbsent, findUnique } = makeSut();
    insertIfAbsent.mockResolvedValue(null);
    findUnique.mockResolvedValue(existingRow({ status: 'SUSPENDED' }));

    await expect(useCase.execute(REQUEST)).resolves.toEqual({ status: 'BUSY' });
  });
});
