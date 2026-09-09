import { ConfigService } from '@config/config.service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/client';
import { LoggerPort } from '@platform/observability/ports/logger.port';
import { Pool } from 'pg';

/**
 * Write database client. All writes go through this connection; reads through
 * PrismaReadService (replica when configured).
 */
@Injectable()
export class PrismaWriteService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly logger = new Logger(PrismaWriteService.name);

  constructor(configService: ConfigService) {
    const dbConfig = configService.getPostgres();
    const pool = new Pool({ connectionString: dbConfig.url });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('prisma-write-connected');
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('prisma-write-disconnected');
  }
}
