import { SagaOutboxWriterAdapter } from './saga-outbox-writer.adapter';
import { AppendSagaOutboxEventUseCase } from '../use-cases/append-saga-outbox-event.usecase';
import {
  DEFAULT_BROKER_TARGET,
  OutboxEventBase,
} from '@platform/platform-common/outbox/types/outbox.types';

/**
 * Unit — the writer port is the saga's only way into `saga_outbox`.
 *
 * The adapter must be a pure delegation: envelope shaping and tenancy belong to
 * the use case, so a rule appearing here would mean two places to change.
 */
describe('SagaOutboxWriterAdapter', () => {
  class SagaCompletedEvent extends OutboxEventBase {
    public readonly sagaKey = 'grn-to-invoice';
  }

  it('delegates the event, aggregate and options to the append use case', async () => {
    const append = { execute: jest.fn(async (..._args: unknown[]) => undefined) };
    const adapter = new SagaOutboxWriterAdapter(append as unknown as AppendSagaOutboxEventUseCase);
    const event = new SagaCompletedEvent();

    await adapter.append(event, 'SagaInstance', 'instance-1', {
      broker: DEFAULT_BROKER_TARGET,
    });

    expect(append.execute).toHaveBeenCalledWith(event, 'SagaInstance', 'instance-1', {
      broker: DEFAULT_BROKER_TARGET,
    });
  });

  it('passes undefined options through unchanged', async () => {
    const append = { execute: jest.fn(async (..._args: unknown[]) => undefined) };
    const adapter = new SagaOutboxWriterAdapter(append as unknown as AppendSagaOutboxEventUseCase);

    await adapter.append(new SagaCompletedEvent(), 'SagaInstance', 'instance-1');

    expect(append.execute.mock.calls[0][3]).toBeUndefined();
  });
});
