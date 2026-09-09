import { ConfigService } from '@config/config.service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/client';
import { LoggerPort } from '@platform/observability/ports/logger.port';
import { Pool } from 'pg';

/**
 * Read/replica database client. Reads through this connection are optimized
 * for projections and queries; writes always go through PrismaWriteService.
 */
@Injectable()
export class PrismaReadService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly logger = new Logger(PrismaReadService.name);

  constructor(configService: ConfigService) {
    const dbConfig = configService.getPostgres();
    const pool = new Pool({ connectionString: dbConfig.readUrl });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('prisma-read-connected');
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('prisma-read-disconnected');
  }
}
