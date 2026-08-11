import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
 * Read/replica database client. Reads through this connection are optimized
 * for projections and queries; writes always go through PrismaWriteService.
 */
@Injectable()
export class PrismaReadService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly configuration: ConfigurationService,
    private readonly logger: LoggerPort,
  ) {
    super({
      datasources: { db: { url: configuration.databaseReadUrl } },
      log: configuration.isProduction
        ? [{ emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
    });

    const eventClient = this as unknown as PrismaEventClient;
    eventClient.$on('error', (event) => {
      this.logger.error('prisma-read-error', { message: event.message });
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.info('prisma-read-connected');
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
