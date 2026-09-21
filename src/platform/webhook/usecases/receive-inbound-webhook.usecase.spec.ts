import {
  IdempotencyPort,
  IdempotencyReserveRequest,
  IdempotencyReserveResult,
  IdempotencyCompleteRequest,
  IdempotencyFailRequest,
} from '@platform/idempotency/ports/idempotency.port';
import { randomUUID } from 'crypto';
import { WebhookInboundHandlerPort } from '../ports/webhook-inbound-handler.port';
import { WebhookInboundSourceRegistry } from '../webhook-inbound-source.registry';
import {
  InvalidWebhookSignatureError,
  UnregisteredWebhookInboundSourceError,
} from '../webhook.errors';
import { ReceiveInboundWebhookUseCase } from './receive-inbound-webhook.usecase';

class FakeIdempotencyPort implements IdempotencyPort {
  private readonly completed = new Map<string, unknown>();

  reserve(request: IdempotencyReserveRequest): Promise<IdempotencyReserveResult> {
    const key = `${request.scope}:${request.key}`;
    if (this.completed.has(key)) {
      return Promise.resolve({ status: 'REPLAY', result: this.completed.get(key) });
    }
    return Promise.resolve({
      status: 'ACQUIRED',
      reservation: { id: randomUUID(), claimToken: randomUUID(), version: 1 },
    });
  }

  complete(request: IdempotencyCompleteRequest): Promise<void> {
    this.completed.set('webhook.inbound.stripe:evt_1', request.result);
    return Promise.resolve();
  }

  fail(_request: IdempotencyFailRequest): Promise<void> {
    return Promise.resolve();
  }
}

describe('ReceiveInboundWebhookUseCase', () => {
  it('throws UnregisteredWebhookInboundSourceError for a source with no registered handler', async () => {
    const registry = new WebhookInboundSourceRegistry();
    const useCase = new ReceiveInboundWebhookUseCase(registry, new FakeIdempotencyPort());

    await expect(useCase.execute('unknown-source', {}, undefined, undefined)).rejects.toThrow(
      UnregisteredWebhookInboundSourceError,
    );
  });

  it('throws InvalidWebhookSignatureError when verify() rejects the payload', async () => {
    const registry = new WebhookInboundSourceRegistry();
    const handleMock = jest.fn();
    const handler: WebhookInboundHandlerPort = { handle: handleMock };
    registry.register('stripe', { verify: () => false, handler });
    const useCase = new ReceiveInboundWebhookUseCase(registry, new FakeIdempotencyPort());

    await expect(useCase.execute('stripe', {}, 'bad-signature', undefined)).rejects.toThrow(
      InvalidWebhookSignatureError,
    );
    expect(handleMock).not.toHaveBeenCalled();
  });

  it('calls the handler once, then replays (no second handler call) for the same idempotencyKey', async () => {
    const registry = new WebhookInboundSourceRegistry();
    const handleMock = jest.fn().mockResolvedValue(undefined);
    const handler: WebhookInboundHandlerPort = { handle: handleMock };
    registry.register('stripe', { verify: () => true, handler });
    const useCase = new ReceiveInboundWebhookUseCase(registry, new FakeIdempotencyPort());

    await useCase.execute('stripe', { id: 'evt_1' }, 'sig', 'evt_1');
    await useCase.execute('stripe', { id: 'evt_1' }, 'sig', 'evt_1');

    expect(handleMock).toHaveBeenCalledTimes(1);
  });
});
