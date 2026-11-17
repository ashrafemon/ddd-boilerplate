import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { ensureEnvLoaded } from '@common/application/utils/env.util';
import appConfig from '@config/app.config';
import observabilityConfig from '@config/observability.config';

/**
 * Initializes Sentry for error tracking. No-op unless SENTRY_DSN is set, so
 * local development runs without Sentry. All env vars come from the typed
 * config facades (config owns every environment variable) — never raw
 * process.env here.
 *
 * Runs before NestFactory.create so boot-time errors (module init, DI
 * failures) are captured as well.
 */
export function configureSentry(): void {
  ensureEnvLoaded();
  const { dsn, tracesSampleRate } = observabilityConfig().sentry;
  if (!dsn) return;

  Sentry.init({ dsn, environment: appConfig().env, tracesSampleRate });
  new Logger('Bootstrap').log('Sentry initialized');
}
