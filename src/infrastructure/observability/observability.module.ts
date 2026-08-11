import { Global, Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryService } from './sentry/sentry.service';

/**
 * Infrastructure observability module. Implements the platform observability
 * ports (logging, metrics, error tracking) with concrete clients.
 */
@Global()
@Module({
  imports: [SentryModule.forRoot()],
  providers: [SentryService],
  exports: [],
})
export class ObservabilityModule {}
