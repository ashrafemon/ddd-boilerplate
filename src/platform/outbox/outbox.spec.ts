import { Test, TestingModule } from '@nestjs/testing';
import { OutboxPort } from './ports/outbox.port';
import { OutboxService } from './outbox.service';
import { OutboxRepositoryPort } from './ports/outbox-repository.port';
import { AppendOutboxEventUseCase } from './usecases/append-outbox-event.usecase';
import { AppendOutboxEventsBatchUseCase } from './usecases/append-outbox-events-batch.usecase';
import { ClaimOutboxMessagesUseCase } from './usecases/claim-outbox-messages.usecase';
import { MarkOutboxPublishedUseCase } from './usecases/mark-outbox-published.usecase';
import { MarkOutboxFailedUseCase } from './usecases/mark-outbox-failed.usecase';
import { ReleaseOutboxClaimUseCase } from './usecases/release-outbox-claim.usecase';
import { InMemoryOutboxRepository } from './__testing__/in-memory-outbox.repository';
import { OutboxStatus } from './outbox.types';
import { randomUUID } from 'crypto';

describe('Outbox Module — Integration', () => {
  let module: TestingModule;
  let outboxPort: OutboxPort;
  let repository: InMemoryOutboxRepository;

  beforeAll(async () => {
    repository = new InMemoryOutboxRepository();
    module = await Test.createTestingModule({
      providers: [
        OutboxService,
        { provide: OutboxPort, useExisting: OutboxService },
        { provide: OutboxRepositoryPort, useValue: repository },
        AppendOutboxEventUseCase,
        AppendOutboxEventsBatchUseCase,
        ClaimOutboxMessagesUseCase,
        MarkOutboxPublishedUseCase,
        MarkOutboxFailedUseCase,
        ReleaseOutboxClaimUseCase,
      ],
    }).compile();

    outboxPort = module.get(OutboxPort);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    repository.clear();
  });

  describe('append (single)', () => {
    it('should append a single event and return an OutboxMessage', async () => {
      const result = await outboxPort.append({
        tenantId: 't1',
        organizationId: 'o1',
        eventType: 'SalesOrderCreated',
        eventVersion: 1,
        aggregateType: 'SalesOrder',
        aggregateId: randomUUID(),
        payload: { orderId: 'order-1', total: 100 },
        occurredAt: new Date(),
        correlationId: 'corr-1',
        causationId: 'cmd-1',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.eventId).toBeDefined();
      expect(result.eventType).toBe('SalesOrderCreated');
      expect(result.eventVersion).toBe(1);
      expect(result.aggregateType).toBe('SalesOrder');
      expect(result.tenantId).toBe('t1');
      expect(result.organizationId).toBe('o1');
      expect(result.status).toBe(OutboxStatus.PENDING);
      expect(result.correlationId).toBe('corr-1');
      expect(result.causationId).toBe('cmd-1');
      expect(result.attempts).toBe(0);
      expect(result.claimToken).toBeNull();
      expect(result.version).toBe(1);
      expect(result.payload).toEqual({ orderId: 'order-1', total: 100 });
    });

    it('should store the event in the repository', async () => {
      await outboxPort.append({
        eventType: 'ProductCreated',
        aggregateType: 'Product',
        aggregateId: randomUUID(),
        payload: { sku: 'ABC-123' },
      });

      const all = repository.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].eventType).toBe('ProductCreated');
    });
  });

  describe('appendMany (batch)', () => {
    it('should append multiple events in one call', async () => {
      const results = await outboxPort.appendMany([
        {
          eventType: 'OrderLineAdded',
          aggregateType: 'SalesOrder',
          aggregateId: randomUUID(),
          payload: { lineId: 'l1' },
        },
        {
          eventType: 'OrderLineAdded',
          aggregateType: 'SalesOrder',
          aggregateId: randomUUID(),
          payload: { lineId: 'l2' },
        },
        {
          eventType: 'OrderSubmitted',
          aggregateType: 'SalesOrder',
          aggregateId: randomUUID(),
          payload: { status: 'submitted' },
        },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].eventType).toBe('OrderLineAdded');
      expect(results[1].eventType).toBe('OrderLineAdded');
      expect(results[2].eventType).toBe('OrderSubmitted');

      const all = repository.getAll();
      expect(all).toHaveLength(3);
    });

    it('should return empty array for empty input', async () => {
      const results = await outboxPort.appendMany([]);
      expect(results).toEqual([]);
    });
  });

  describe('claimBatch', () => {
    it('should claim PENDING messages with FOR UPDATE SKIP LOCKED semantics', async () => {
      // Append some events
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });
      await outboxPort.append({
        eventType: 'Event2',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 2 },
      });

      // Claim them
      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });

      expect(claimed).toHaveLength(2);
      expect(claimed[0].status).toBe('CLAIMED');
      expect(claimed[0].claimToken).toBeDefined();
      expect(claimed[0].attempts).toBe(1);
    });

    it('should not claim messages beyond maxAttempts', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      // Claim once (attempts becomes 1)
      await repository.claimBatch({ batchSize: 10, maxAttempts: 1 });

      // Try to claim again with maxAttempts=1 — should not claim (attempts=1 not < 1)
      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 1 });
      expect(claimed).toHaveLength(0);
    });

    it('should not claim messages with future availableAt', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      // Mark as failed with future availableAt
      const all = repository.getAll();
      const msg = all[0];
      await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });
      await repository.markFailed(
        msg.id,
        'test-claim-token',
        'error',
        new Date(Date.now() + 3600000),
        10,
      );

      // Try to claim again — should not claim because availableAt is in the future
      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });
      expect(claimed).toHaveLength(0);
    });

    it('should respect batchSize limit', async () => {
      for (let i = 0; i < 5; i++) {
        await outboxPort.append({
          eventType: 'Event',
          aggregateType: 'Agg',
          aggregateId: randomUUID(),
          payload: { i },
        });
      }

      const claimed = await repository.claimBatch({ batchSize: 3, maxAttempts: 10 });
      expect(claimed).toHaveLength(3);
    });
  });

  describe('markPublished (CAS with claimToken)', () => {
    it('should transition CLAIMED → PUBLISHED when claimToken matches', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });
      expect(claimed).toHaveLength(1);

      await repository.markPublished(claimed[0].id, claimed[0].claimToken);

      const all = repository.getAll();
      expect(all[0].status).toBe(OutboxStatus.PUBLISHED);
      expect(all[0].publishedAt).toBeDefined();
      expect(all[0].claimToken).toBeNull();
    });

    it('should not update if claimToken does not match', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });
      expect(claimed).toHaveLength(1);

      // Try to publish with wrong claimToken
      await repository.markPublished(claimed[0].id, 'wrong-token');

      const all = repository.getAll();
      expect(all[0].status).toBe(OutboxStatus.CLAIMED); // unchanged
    });

    it('should be idempotent — calling markPublished twice is safe', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });
      await repository.markPublished(claimed[0].id, claimed[0].claimToken);
      await repository.markPublished(claimed[0].id, 'wrong-token'); // second call — no-op

      const all = repository.getAll();
      expect(all[0].status).toBe(OutboxStatus.PUBLISHED);
    });
  });

  describe('markFailed with exponential backoff', () => {
    it('should transition CLAIMED → FAILED with availableAt for retry', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });
      const now = new Date(Date.now() + 5000); // 5 seconds in future

      await repository.markFailed(
        claimed[0].id,
        claimed[0].claimToken,
        'connection timeout',
        now,
        10,
      );

      const all = repository.getAll();
      expect(all[0].status).toBe(OutboxStatus.FAILED);
      expect(all[0].lastError).toBe('connection timeout');
      expect(all[0].availableAt.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000);
      expect(all[0].claimToken).toBeNull();
    });

    it('should transition to DEAD_LETTER when attempts >= maxAttempts', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      // Claim with maxAttempts=1 (attempts becomes 1, which >= maxAttempts)
      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 1 });
      expect(claimed).toHaveLength(1);
      expect(claimed[0].attempts).toBe(1);

      const futureDate = new Date(Date.now() + 5000);
      await repository.markFailed(claimed[0].id, claimed[0].claimToken, 'error', futureDate, 1);

      const all = repository.getAll();
      expect(all[0].status).toBe(OutboxStatus.DEAD_LETTER);
    });
  });

  describe('releaseExpiredClaims', () => {
    it('should release CLAIMED rows with expired leases back to PENDING', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      // Claim the message
      await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });

      // Simulate lease expiration: move claimedAt back 120 seconds
      const all = repository.getAll();
      all[0].claimedAt = new Date(Date.now() - 120_000);

      // Release claims that are older than "now"
      const released = await repository.releaseExpiredClaims(new Date());

      expect(released).toBe(1);
      expect(all[0].status).toBe(OutboxStatus.PENDING);
      expect(all[0].claimedAt).toBeNull();
      expect(all[0].claimToken).toBeNull();
    });

    it('should not release recent CLAIMED rows', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      // Claim the message (claimedAt = now)
      await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });

      // Try to release — should not release because claimedAt is recent
      const released = await repository.releaseExpiredClaims(new Date(Date.now() - 120_000));

      expect(released).toBe(0);
      const all = repository.getAll();
      expect(all[0].status).toBe(OutboxStatus.CLAIMED);
    });
  });

  describe('dead letter after max attempts', () => {
    it('should stop retrying after max attempts are exhausted', async () => {
      await outboxPort.append({
        eventType: 'PoisonEvent',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { bad: true },
      });

      // Claim with maxAttempts=3
      let claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 3 });
      expect(claimed).toHaveLength(1);

      // Fail it (attempts=1, availableAt in future)
      await repository.markFailed(
        claimed[0].id,
        claimed[0].claimToken,
        'error-1',
        new Date(Date.now() - 1000), // available immediately
        3,
      );

      // Second claim
      claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 3 });
      expect(claimed).toHaveLength(1);
      await repository.markFailed(
        claimed[0].id,
        claimed[0].claimToken,
        'error-2',
        new Date(Date.now() - 1000),
        3,
      );

      // Third claim (attempts becomes 3, which is NOT < maxAttempts=3 for next claim)
      claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 3 });
      expect(claimed).toHaveLength(1);

      // Mark failed — at this point attempts=3, maxAttempts=3 → DEAD_LETTER
      await repository.markFailed(
        claimed[0].id,
        claimed[0].claimToken,
        'error-3',
        new Date(Date.now() - 1000),
        3,
      );

      const all = repository.getAll();
      expect(all[0].status).toBe(OutboxStatus.DEAD_LETTER);

      // Should not be claimable anymore
      claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 3 });
      expect(claimed).toHaveLength(0);
    });
  });

  describe('deletePublishedOlderThan', () => {
    it('should delete old PUBLISHED messages', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });
      await repository.markPublished(claimed[0].id, claimed[0].claimToken);

      // Simulate old publishedAt
      const all = repository.getAll();
      all[0].publishedAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

      const deleted = await repository.deletePublishedOlderThan(24);
      expect(deleted).toBe(1);
      expect(repository.getAll()).toHaveLength(0);
    });

    it('should not delete recent PUBLISHED messages', async () => {
      await outboxPort.append({
        eventType: 'Event1',
        aggregateType: 'Agg',
        aggregateId: randomUUID(),
        payload: { a: 1 },
      });

      const claimed = await repository.claimBatch({ batchSize: 10, maxAttempts: 10 });
      await repository.markPublished(claimed[0].id, claimed[0].claimToken);

      const deleted = await repository.deletePublishedOlderThan(24);
      expect(deleted).toBe(0);
      expect(repository.getAll()).toHaveLength(1);
    });
  });
});
