import { Injectable, OnApplicationShutdown, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigurationService } from '../../../config/configuration.service';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';

interface PrismaLogEvents {
  message: string;
  timestamp: Date;
}

type PrismaEventClient = {
  $on(level: 'query' | 'info' | 'warn' | 'error', cb: (event: PrismaLogEvents) => void): void;
};

/**
 * Write/primary database client. Extends PrismaClient so the
 * @nestjs-cls/transactional Prisma adapter can drive `$transaction` and expose
 * the transactional client through CLS.
 */
@Injectable()
export class PrismaWriteService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  constructor(
    private readonly configuration: ConfigurationService,
    private readonly logger: LoggerPort,
  ) {
    super({
      datasources: { db: { url: configuration.databaseUrl } },
      log: configuration.isProduction
        ? [{ emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
    });

    const eventClient = this as unknown as PrismaEventClient;
    eventClient.$on('error', (event) => {
      this.logger.error('prisma-write-error', { message: event.message });
    });

    eventClient.$on('warn', (event) => {
      this.logger.warn('prisma-write-warn', { message: event.message });
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.info('prisma-write-connected');
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
