import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@shared-kernel/exceptions/infrastructure.exception';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/client';
import { Pool } from 'pg';
import { PrismaWriteService } from './prisma-write.service';

/**
 * Read/replica database client. Reads through this connection are optimized
 * for projections and queries; writes always go through PrismaWriteService.
 */
@Injectable()
export class PrismaReadService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;
  private readonly logger = new Logger(PrismaReadService.name);

  constructor(
    private readonly configService: ConfigService,
    writeService: PrismaWriteService,
  ) {
    const dbConfig = configService.getPostgres();
    const readUrl = dbConfig.readUrl ?? dbConfig.url;
    const shared = readUrl === writeService.connectionString;

    // The adapter never ends an externally supplied pool (unless
    // `disposeExternalPool`), so only its creator may close it here.
    const pool = shared ? writeService.pool : new Pool({ connectionString: readUrl });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    this.ownsPool = !shared;
  }

  public async onModuleInit(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log('prisma-read-connected');
    } catch (error) {
      const reason = (error as Error).message;
      if (this.configService.isProduction) {
        throw new InfrastructureException('prisma-read-unreachable', { reason });
      }
      this.logger.error(`prisma-read-unreachable: ${reason}`);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    if (this.ownsPool) {
      await this.pool.end();
    }
    this.logger.log('prisma-read-disconnected');
  }
}
