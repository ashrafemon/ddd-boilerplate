import { Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigService } from '@config/config.service';
import { CompanyConfig, CompanyConfigPort } from './ports/company-config.port';

/**
 * Prisma-backed company configuration adapter. Reads the configured company
 * through the TransactionHost so the lookup participates in the caller's
 * transaction. Falls back to a default configuration when no row exists (e.g.
 * first boot) so local development and tests run without seeding.
 */
@Injectable()
export class PrismaCompanyConfigAdapter implements CompanyConfigPort {
  private readonly logger = new Logger(PrismaCompanyConfigAdapter.name);

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly configService: ConfigService,
  ) {}

  public async getCompanyConfig(
    companyId = '00000000-0000-0000-0000-000000000000',
  ): Promise<CompanyConfig> {
    try {
      const row = await this.txHost.tx.companyConfig.findUnique({
        where: { companyId },
      });
      if (row) {
        return {
          companyId: row.companyId,
          companyCode: row.companyCode,
          companyName: row.companyName,
          defaultCurrency: row.defaultCurrency,
          autoApproveThreshold: Number(row.autoApproveThreshold),
          isActive: row.isActive,
        };
      }
    } catch (error) {
      this.logger.warn(
        `Company config lookup failed for ${companyId}: ${(error as Error).message}`,
      );
    }

    return this.defaultConfig(companyId);
  }

  private defaultConfig(companyId: string): CompanyConfig {
    return {
      companyId,
      companyCode: 'DEFAULT',
      companyName: this.configService.appName,
      defaultCurrency: 'USD',
      autoApproveThreshold: 10_000,
      isActive: true,
    };
  }
}
