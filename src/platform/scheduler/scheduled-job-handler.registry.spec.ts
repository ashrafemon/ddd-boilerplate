import { ScheduledJobHandlerRegistry } from './scheduled-job-handler.registry';
import { ScheduledJobFireHandler } from './ports/scheduled-job-fire-handler.port';

const fakeHandler: ScheduledJobFireHandler = { handle: () => Promise.resolve() };

describe('ScheduledJobHandlerRegistry', () => {
  it('resolves a handler registered for a jobType', () => {
    const registry = new ScheduledJobHandlerRegistry();
    registry.register('Recurring', fakeHandler);

    expect(registry.resolveHandler('Recurring')).toBe(fakeHandler);
  });

  it('throws DuplicateHandlerRegistrationError on a second registration for the same jobType', () => {
    const registry = new ScheduledJobHandlerRegistry();
    registry.register('Recurring', fakeHandler);

    expect(() => registry.register('Recurring', fakeHandler)).toThrow(/already registered/);
  });

  it('throws UnregisteredHandlerError for a jobType with no handler', () => {
    const registry = new ScheduledJobHandlerRegistry();

    expect(() => registry.resolveHandler('Unknown')).toThrow(
      /No ScheduledJobFireHandler registered/,
    );
  });

  it('tryFire returns false when no handler is registered', async () => {
    const registry = new ScheduledJobHandlerRegistry();
    await expect(registry.tryFire('Missing', { jobId: null, jobType: 'Missing' })).resolves.toBe(
      false,
    );
  });
});
