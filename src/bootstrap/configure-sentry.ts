import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

/**
 * Initializes Sentry for error tracking. No-op unless SENTRY_DSN is set, so
 * local development runs without Sentry. This is the single Sentry.init call
 * site; the error tracking adapter only reports.
 *
 * Runs before NestFactory.create so boot-time errors (module init, DI
 * failures) are captured as well.
 */
export function configureSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const environment = process.env.NODE_ENV ?? 'development';
  const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1);
  Sentry.init({ dsn, environment, tracesSampleRate });
  new Logger('Bootstrap').log('Sentry initialized');
}
