import { ConfigService } from '@config/config.service';
import { ChannelProviderRegistry } from '../channel-provider.registry';
import { NotificationHandlerRegistry } from '../notification-handler.registry';
import { NotificationWorker } from '../notification.worker';
import { NotificationQueuePublisherPort } from '../ports/notification-queue-publisher.port';
import { ChannelProvider } from '../ports/channel-provider.port';
import { NotificationHandler } from '../ports/notification-handler.port';
import { InMemoryNotificationRepository } from '../__testing__/in-memory-notification.repository';
import { SendNotificationUseCase } from './send-notification.usecase';
import { Recipient } from '../notification.types';

function fakeChannelProvider(channel: string): ChannelProvider {
  return {
    send: () => Promise.resolve({ providerMessageId: 'x', acceptedAt: new Date() }),
    parseDeliveryReceipt: () => Promise.resolve([]),
    capabilities: () => ({
      channel,
      providerName: 'fake',
      supportsSubject: true,
      maxBodyBytes: 1_000,
      ratePerSecond: 10,
    }),
  };
}

function makeSut(recipients: Recipient[], overrides?: { syncMessageThreshold?: number }) {
  const repo = new InMemoryNotificationRepository();
  const channelProviders = new ChannelProviderRegistry();
  channelProviders.register('EMAIL', fakeChannelProvider('EMAIL'));

  const registry = new NotificationHandlerRegistry(channelProviders);
  const handler: NotificationHandler = {
    resolveRecipients: () => Promise.resolve(recipients),
    resolveModel: () => Promise.resolve({ amount: 100 }),
  };
  registry.register(
    { notificationType: 'InvoiceOverdue', channels: ['EMAIL'], priority: 'HIGH' },
    handler,
  );

  const processChunk = jest.fn().mockResolvedValue(undefined);
  const worker = { processChunk } as unknown as NotificationWorker;
  const dispatchChunks = jest.fn().mockResolvedValue(undefined);
  const queuePublisher = { dispatchChunks } as unknown as NotificationQueuePublisherPort;
  const config = {
    getNotificationPipeline: () => ({
      maxRecipientsPerRequest: 10_000,
      syncMessageThreshold: overrides?.syncMessageThreshold ?? 5,
      chunkSize: 100,
      workerConcurrency: 5,
      chunkAttempts: 3,
      renderTimeoutMs: 2_000,
      renderingStuckWindowMs: 600_000,
      sentNoReceiptWindowMs: 86_400_000,
      payloadMaxBytes: 65_536,
      renderedSnapshotMaxBytes: 262_144,
    }),
  } as unknown as ConfigService;

  const sut = new SendNotificationUseCase(
    repo,
    repo,
    repo,
    registry,
    worker,
    queuePublisher,
    config,
  );
  return { sut, repo, processChunk, dispatchChunks };
}

describe('SendNotificationUseCase', () => {
  it('dedupes on (tenantId, dedupKey) — a repeat returns the existing request without fanning out again', async () => {
    const { sut, processChunk } = makeSut([{ recipientRef: 'user-1', address: 'a@x.com' }]);

    const first = await sut.execute({ notificationType: 'InvoiceOverdue', dedupKey: 'evt-1' });
    const second = await sut.execute({ notificationType: 'InvoiceOverdue', dedupKey: 'evt-1' });

    expect(second.id).toBe(first.id);
    expect(processChunk).toHaveBeenCalledTimes(1);
  });

  it('finalises NO_RECIPIENTS without creating messages when the handler resolves none', async () => {
    const { sut, processChunk, repo } = makeSut([]);

    const request = await sut.execute({ notificationType: 'InvoiceOverdue', dedupKey: 'evt-2' });

    expect(request.status).toBe('NO_RECIPIENTS');
    expect(processChunk).not.toHaveBeenCalled();
    expect(repo.messages.size).toBe(0);
  });

  it('drops an opted-out recipient at the gate and records it Suppressed(Preference), never dispatched', async () => {
    const { sut, repo, processChunk } = makeSut([{ recipientRef: 'user-1', address: 'a@x.com' }]);
    await repo.upsert({
      recipientRef: 'user-1',
      category: 'InvoiceOverdue',
      channel: 'EMAIL',
      optedIn: false,
    });

    const request = await sut.execute({ notificationType: 'InvoiceOverdue', dedupKey: 'evt-3' });

    expect(request.status).toBe('COMPLETED');
    expect(request.suppressedMessages).toBe(1);
    expect(processChunk).not.toHaveBeenCalled();
    const [message] = [...repo.messages.values()];
    expect(message.status).toBe('SUPPRESSED');
    expect(message.suppressReason).toBe('PREFERENCE');
  });

  it('drops a suppressed address at the gate and records it Suppressed(HardBounce)', async () => {
    const { sut, repo } = makeSut([{ recipientRef: 'user-1', address: 'bounced@x.com' }]);
    await repo.suppress(undefined, 'bounced@x.com', 'EMAIL', 'HardBounce');

    await sut.execute({ notificationType: 'InvoiceOverdue', dedupKey: 'evt-4' });

    const [message] = [...repo.messages.values()];
    expect(message.status).toBe('SUPPRESSED');
    expect(message.suppressReason).toBe('HARD_BOUNCE');
  });

  it('runs SYNC in-process when the surviving count is <= threshold and priority is HIGH', async () => {
    const { sut, processChunk, dispatchChunks } = makeSut(
      [{ recipientRef: 'user-1', address: 'a@x.com' }],
      { syncMessageThreshold: 5 },
    );

    const request = await sut.execute({ notificationType: 'InvoiceOverdue', dedupKey: 'evt-5' });

    expect(request.mode).toBe('SYNC');
    expect(processChunk).toHaveBeenCalledTimes(1);
    expect(dispatchChunks).not.toHaveBeenCalled();
  });

  it('runs ASYNC and enqueues chunks above the sync threshold', async () => {
    const recipients: Recipient[] = Array.from({ length: 3 }, (_, i) => ({
      recipientRef: `user-${i}`,
      address: `u${i}@x.com`,
    }));
    const { sut, processChunk, dispatchChunks } = makeSut(recipients, { syncMessageThreshold: 1 });

    const request = await sut.execute({ notificationType: 'InvoiceOverdue', dedupKey: 'evt-6' });

    expect(request.mode).toBe('ASYNC');
    expect(dispatchChunks).toHaveBeenCalledTimes(1);
    expect(processChunk).not.toHaveBeenCalled();
  });
});
