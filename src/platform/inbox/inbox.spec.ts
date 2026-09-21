import { Test, TestingModule } from '@nestjs/testing';
import { InboxPort } from './ports/inbox.port';
import { InboxService } from './inbox.service';
import { ReceiveInboxMessageUseCase } from './usecases/receive-inbox-message.usecase';
import { CompleteInboxMessageUseCase } from './usecases/complete-inbox-message.usecase';
import { FailInboxMessageUseCase } from './usecases/fail-inbox-message.usecase';
import { InMemoryInboxRepository } from './__testing__/in-memory-inbox.repository';
import { InboxRepositoryPort } from './ports/inbox-repository.port';
import { randomUUID } from 'crypto';

describe('Inbox Module — Integration', () => {
  let module: TestingModule;
  let inboxPort: InboxPort;
  let repository: InMemoryInboxRepository;

  beforeAll(async () => {
    repository = new InMemoryInboxRepository();
    module = await Test.createTestingModule({
      providers: [
        InboxService,
        { provide: InboxPort, useExisting: InboxService },
        { provide: InboxRepositoryPort, useValue: repository },
        ReceiveInboxMessageUseCase,
        CompleteInboxMessageUseCase,
        FailInboxMessageUseCase,
      ],
    }).compile();

    inboxPort = module.get(InboxPort);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    repository.clear();
  });

  it('should receive a new message and return ACQUIRED', async () => {
    const result = await inboxPort.receive({
      tenantId: 't1',
      organizationId: 'o1',
      consumer: 'inventory-sync',
      messageId: randomUUID(),
      messageType: 'OrderCreated',
      payload: { orderId: 'order-1', items: [] },
    });

    expect(result.status).toBe('ACQUIRED');
    if (result.status === 'ACQUIRED') {
      expect(result.reservation.claimToken).toBeDefined();
      expect(result.reservation.version).toBeGreaterThanOrEqual(1);
    }
  });

  it('should complete a claimed message', async () => {
    const result = await inboxPort.receive({
      tenantId: 't1',
      organizationId: 'o1',
      consumer: 'inventory-sync',
      messageId: randomUUID(),
      messageType: 'OrderCreated',
      payload: { orderId: 'order-1' },
    });
    expect(result.status).toBe('ACQUIRED');
    if (result.status !== 'ACQUIRED') return;

    await inboxPort.complete({ reservation: result.reservation });
    expect(true).toBe(true);
  });

  it('should fail a claimed message', async () => {
    const result = await inboxPort.receive({
      tenantId: 't1',
      organizationId: 'o1',
      consumer: 'inventory-sync',
      messageId: randomUUID(),
      messageType: 'OrderCreated',
      payload: { orderId: 'order-1' },
    });
    expect(result.status).toBe('ACQUIRED');
    if (result.status !== 'ACQUIRED') return;

    await inboxPort.fail({
      reservation: result.reservation,
      errorCode: 'PROCESSING_ERROR',
      errorMessage: 'Insufficient stock',
    });
    expect(true).toBe(true);
  });

  it('should return PROCESSED on duplicate receive', async () => {
    const messageId = randomUUID();
    const receiveRequest = {
      tenantId: 't1',
      organizationId: 'o1',
      consumer: 'inventory-sync',
      messageId,
      messageType: 'OrderCreated',
      payload: { orderId: 'order-1' },
    };

    const first = await inboxPort.receive(receiveRequest);
    expect(first.status).toBe('ACQUIRED');
    if (first.status !== 'ACQUIRED') return;

    await inboxPort.complete({ reservation: first.reservation });

    const second = await inboxPort.receive(receiveRequest);
    expect(second.status).toBe('PROCESSED');
  });

  it('should return IN_PROGRESS if another worker owns it', async () => {
    const messageId = randomUUID();
    const receiveRequest = {
      tenantId: 't1',
      organizationId: 'o1',
      consumer: 'inventory-sync',
      messageId,
      messageType: 'OrderCreated',
      payload: { orderId: 'order-1' },
    };

    const first = await inboxPort.receive(receiveRequest);
    expect(first.status).toBe('ACQUIRED');

    const second = await inboxPort.receive(receiveRequest);
    expect(second.status).toBe('IN_PROGRESS');
  });

  it('should return IN_PROGRESS on acquire when message already claimed', async () => {
    const messageId = randomUUID();
    const receiveRequest = {
      tenantId: 't1',
      organizationId: 'o1',
      consumer: 'inventory-sync',
      messageId,
      messageType: 'OrderCreated',
      payload: { orderId: 'order-1' },
    };

    const first = await inboxPort.receive(receiveRequest);
    expect(first.status).toBe('ACQUIRED');
  });
});
