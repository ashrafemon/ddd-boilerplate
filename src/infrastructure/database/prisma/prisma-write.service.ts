import { ConfigService } from '@config/config.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';
import { Pool } from 'pg';

/**
 * Read/replica database client. Reads through this connection are optimized
 * for projections and queries; writes always go through PrismaWriteService.
 */
@Injectable()
export class PrismaWriteService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(
    configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const dbConfig = configService.getPostgres();
    const pool = new Pool({ connectionString: dbConfig.readUrl });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.info('prisma-write-connected');
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.info('prisma-write-connected');
  }
}
