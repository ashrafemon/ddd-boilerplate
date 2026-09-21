import { registerAs } from '@nestjs/config';
import { numericEnv, booleanEnv } from './env.util';
import { IEventBusConfig } from '@platform/events/event-bus.types';

/**
 * Event Bus configuration.
 */
export default registerAs('eventBus', (): IEventBusConfig => ({
  provider: (process.env.EVENT_BUS_PROVIDER as IEventBusConfig['provider']) ?? 'nest',
  maxHandlerConcurrency: numericEnv('EVENT_BUS_MAX_HANDLER_CONCURRENCY', 20),
  handlerTimeoutMs: numericEnv('EVENT_BUS_HANDLER_TIMEOUT_MS', 30_000),
  failFast: booleanEnv('EVENT_BUS_FAIL_FAST', false),
  retryEnabled: booleanEnv('EVENT_BUS_RETRY_ENABLED', true),
  maxAttempts: numericEnv('EVENT_BUS_MAX_ATTEMPTS', 10),
}));
