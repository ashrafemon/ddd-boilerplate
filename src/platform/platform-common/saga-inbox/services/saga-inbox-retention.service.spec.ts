import { PurgeSagaInboxUseCase } from '../use-cases/purge-saga-inbox.usecase';
import { SagaInboxRetentionService } from './saga-inbox-retention.service';

/**
 * Unit — the only clock `saga_inbox` has.
 *
 * Retention is hourly and idempotent: deleting nothing must stay silent, and the
 * service must never invent its own window.
 */
describe('SagaInboxRetentionService', () => {
  function makeSut(deleted = 0) {
    const purgeInbox = { execute: jest.fn(async () => deleted) };
    const service = new SagaInboxRetentionService(purgeInbox as unknown as PurgeSagaInboxUseCase);
    return { service, purgeInbox };
  }

  it('delegates the sweep to the purge use case', async () => {
    const { service, purgeInbox } = makeSut(4);

    await service.purge();

    expect(purgeInbox.execute).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when nothing is past retention', async () => {
    const { service, purgeInbox } = makeSut(0);
    const log = jest.spyOn(service['logger'], 'log');

    await service.purge();

    expect(purgeInbox.execute).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });
});
