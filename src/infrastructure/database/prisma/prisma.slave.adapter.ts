import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'prisma/generated/prisma/client';

@Injectable()
export class PrismaSlaveAdapter extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaSlaveAdapter.name);

  constructor(configService: ConfigService) {
    const dbUrl = configService.getOrThrow<string>('database.slaveUrl', '');
    const adapter = new PrismaPg({ connectionString: dbUrl });
    super({ adapter });
  }

  async onModuleInit() {
    this.logger.log('Slave database connection start');

    try {
      await this.$connect();
      this.logger.log('Slave database connection success');
    } catch (err) {
      this.logger.error('Slave database connection error');
      this.logger.error((err as Error).message);
    }
  }

  async onModuleDestroy() {
    this.logger.log('Slave database disconnect start');

    try {
      await this.$disconnect();
      this.logger.log('Slave database disconnect success');
    } catch (err) {
      this.logger.error('Slave database disconnect error');
      this.logger.error((err as Error).message);
    }
  }
}
