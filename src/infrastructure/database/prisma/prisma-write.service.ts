import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@shared-kernel/exceptions/infrastructure.exception';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/client';
import { Pool } from 'pg';

/**
 * Write database client. All writes go through this connection; reads through
 * PrismaReadService (replica when configured).
 */
@Injectable()
export class PrismaWriteService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Connection string this client was built with, and the pool it owns.
   * `PrismaReadService` reuses the pool when no separate replica is configured
   * so a single-node deployment does not open two pools against the same DB.
   */
  public readonly connectionString: string;
  public readonly pool: Pool;
  private readonly logger = new Logger(PrismaWriteService.name);

  constructor(private readonly configService: ConfigService) {
    const dbConfig = configService.getPostgres();
    const connectionString = dbConfig.url;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.connectionString = connectionString;
    this.pool = pool;
  }

  public async onModuleInit(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log('prisma-write-connected');
    } catch (error) {
      const reason = (error as Error).message;
      if (this.configService.isProduction) {
        throw new InfrastructureException('prisma-write-unreachable', { reason });
      }
      this.logger.error(`prisma-write-unreachable: ${reason}`);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('prisma-write-disconnected');
  }
}
