import { ConfigService } from '@config/config.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';

@Injectable()
export class SentryService implements OnModuleInit, OnModuleDestroy {
  constructor(
    configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const config = configService.getSentry();
    const env = configService.env;
    Sentry.init({ dsn: config.dsn, environment: env, tracesSampleRate: config.tracesSampleRate });
  }

  onModuleInit() {
    this.logger.info('Sentry connected');
  }

  onModuleDestroy() {
    this.logger.info('Sentry discounnted');
  }
}
