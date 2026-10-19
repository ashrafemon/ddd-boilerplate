import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@config/config.service';
import { InboxPort } from './ports/inbox.port';
import { InboxService } from './inbox.service';
import { PrismaInboxRepository } from './repositories/prisma-inbox.repository';
import { ReceiveInboxMessageUseCase } from './usecases/receive-inbox-message.usecase';
import { CompleteInboxMessageUseCase } from './usecases/complete-inbox-message.usecase';
import { FailInboxMessageUseCase } from './usecases/fail-inbox-message.usecase';
import { InboxIdentity, InboxMessage } from './inbox.types';

/**
 * In-memory stand-in for the concrete repository. It lives in the spec (common
 * services ship no test doubles) and mirrors only the guard rails under test:
 * insert-as-claim, CAS on the claim token, and `fail` marking the retry due.
 */
class FakeInboxRepository {
  private readonly rows = new Map<string, InboxMessage>();

  private key(identity: InboxIdentity): string {
    return `${identity.tenantId}|${identity.companyId}|${identity.consumer}|${identity.messageId}`;
  }

  private byId(id: string): InboxMessage | undefined {
    return [...this.rows.values()].find(row => row.id === id);
  }

  insertIfAbsent(input: {
    identity: InboxIdentity;
    messageType: string;
    payload: unknown;
    claimToken: string;
    claimedAt: Date;
  }): Promise<{ id: string } | null> {
    const key = this.key(input.identity);
    if (this.rows.has(key)) {
      return Promise.resolve(null);
    }
    const id = `${input.identity.consumer}:${input.identity.messageId}`;
    this.rows.set(key, {
      id,
      ...input.identity,
      messageType: input.messageType,
      payload: input.payload,
      status: 'IN_PROGRESS',
      attempts: 1,
      claimToken: input.claimToken,
      claimedAt: input.claimedAt,
      processedAt: null,
      nextAttemptAt: null,
      lastError: null,
      correlationId: null,
      causationId: null,
    });
    return Promise.resolve({ id });
  }

  findUnique(identity: InboxIdentity): Promise<InboxMessage | null> {
    return Promise.resolve(this.rows.get(this.key(identity)) ?? null);
  }

  reclaim(id: string, previous: string, token: string, now: Date): Promise<boolean> {
    const row = this.byId(id);
    if (!row || row.claimToken !== previous || row.status !== 'IN_PROGRESS') {
      return Promise.resolve(false);
    }
    row.claimToken = token;
    row.claimedAt = now;
    row.nextAttemptAt = null;
    row.attempts += 1;
    return Promise.resolve(true);
  }

  complete(id: string, token: string): Promise<boolean> {
    const row = this.byId(id);
    if (!row || row.claimToken !== token || row.status !== 'IN_PROGRESS') {
      return Promise.resolve(false);
    }
    row.status = 'PROCESSED';
    row.processedAt = new Date();
    row.claimedAt = null;
    row.nextAttemptAt = null;
    return Promise.resolve(true);
  }

  fail(id: string, token: string, lastError: string | null): Promise<boolean> {
    const row = this.byId(id);
    if (!row || row.claimToken !== token || row.status !== 'IN_PROGRESS') {
      return Promise.resolve(false);
    }
    row.claimedAt = null;
    row.lastError = lastError;
    // The real sweep backoffs into the future; here the retry is due at once.
    row.nextAttemptAt = new Date(Date.now() - 1_000);
    return Promise.resolve(true);
  }

  suspend(messageId: string): void {
    const row = [...this.rows.values()].find(candidate => candidate.messageId === messageId);
    if (row) {
      row.status = 'SUSPENDED';
    }
  }
}

const inboxConfig = {
  claimLeaseMs: 300_000,
  maxAttempts: 5,
  retryBaseDelayMs: 5_000,
  retryMaxDelayMs: 600_000,
  reconciliationIntervalMs: 60_000,
  processedRetentionMs: 2_592_000_000,
};

describe('Inbox (design 07) — consumer-side deduplication', () => {
  let module: TestingModule;
  let inbox: InboxPort;
  let repository: FakeInboxRepository;

  const request = (messageId: string) => ({
    tenantId: 't1',
    companyId: 'c1',
    consumer: 'grn-cache',
    messageId,
    messageType: 'inventory.grn.created',
    payload: { grnId: 'grn-77' },
  });

  beforeAll(async () => {
    repository = new FakeInboxRepository();
    module = await Test.createTestingModule({
      providers: [
        ReceiveInboxMessageUseCase,
        CompleteInboxMessageUseCase,
        FailInboxMessageUseCase,
        InboxService,
        { provide: InboxPort, useExisting: InboxService },
        { provide: PrismaInboxRepository, useValue: repository },
        { provide: ConfigService, useValue: { getInbox: () => inboxConfig } },
      ],
    }).compile();
    inbox = module.get(InboxPort);
  });

  afterAll(async () => {
    await module.close();
  });

  it('acquires the first delivery', async () => {
    const result = await inbox.receive(request('evt-1'));
    expect(result.status).toBe('ACQUIRED');
    if (result.status === 'ACQUIRED') {
      expect(result.reservation.claimToken).toBeDefined();
    }
  });

  it('returns DUPLICATE once the message is PROCESSED', async () => {
    const first = await inbox.receive(request('evt-2'));
    expect(first.status).toBe('ACQUIRED');
    if (first.status !== 'ACQUIRED') return;

    await inbox.complete({ reservation: first.reservation });
    expect((await inbox.receive(request('evt-2'))).status).toBe('DUPLICATE');
  });

  it('returns BUSY while another worker holds the claim', async () => {
    expect((await inbox.receive(request('evt-3'))).status).toBe('ACQUIRED');
    expect((await inbox.receive(request('evt-3'))).status).toBe('BUSY');
  });

  it('re-claims a failed message once the retry is due', async () => {
    const first = await inbox.receive(request('evt-4'));
    expect(first.status).toBe('ACQUIRED');
    if (first.status !== 'ACQUIRED') return;

    await inbox.fail({ reservation: first.reservation, lastError: 'boom' });
    const again = await inbox.receive(request('evt-4'));
    expect(again.status).toBe('ACQUIRED');
    if (again.status === 'ACQUIRED') {
      expect(again.reservation.claimToken).not.toBe(first.reservation.claimToken);
    }
  });

  it('returns BUSY for a SUSPENDED (poison) message', async () => {
    expect((await inbox.receive(request('evt-5'))).status).toBe('ACQUIRED');
    repository.suspend('evt-5');
    expect((await inbox.receive(request('evt-5'))).status).toBe('BUSY');
  });

  it('ignores a complete when ownership was lost', async () => {
    const first = await inbox.receive(request('evt-6'));
    expect(first.status).toBe('ACQUIRED');
    if (first.status !== 'ACQUIRED') return;

    await inbox.complete({ reservation: { ...first.reservation, claimToken: 'stale-token' } });
    expect((await inbox.receive(request('evt-6'))).status).toBe('BUSY');
  });
});
