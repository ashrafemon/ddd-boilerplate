import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'prisma/generated/prisma/client';

@Injectable()
export class PrismaMasterAdapter extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaMasterAdapter.name);

  constructor(configService: ConfigService) {
    const dbUrl = configService.getOrThrow<string>('database.url', '');
    const adapter = new PrismaPg({ connectionString: dbUrl });
    super({ adapter });
  }

  async onModuleInit() {
    this.logger.log('Master database connection start');

    try {
      await this.$connect();
      this.logger.log('Master database connection success');
    } catch (err) {
      this.logger.error('Master database connection error');
      this.logger.error((err as Error).message);
    }
  }

  async onModuleDestroy() {
    this.logger.log('Master database disconnect start');

    try {
      await this.$disconnect();
      this.logger.log('Master database disconnect success');
    } catch (err) {
      this.logger.error('Master database disconnect error');
      this.logger.error((err as Error).message);
    }
  }
}
