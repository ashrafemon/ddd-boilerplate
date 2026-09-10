import { Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigService } from '@config/config.service';
import { CompanyConfig, CompanyConfigPort, DEFAULT_COMPANY_ID } from './ports/company-config.port';

/**
 * Prisma-backed company configuration adapter. Reads the configured company
 * through the TransactionHost so the lookup participates in the caller's
 * transaction. Falls back to a default configuration only when no row exists
 * (first boot, unseeded database); a failing query is an infrastructure fault
 * and is propagated instead of being hidden behind defaults.
 */
@Injectable()
export class PrismaCompanyConfigAdapter implements CompanyConfigPort {
  private readonly logger = new Logger(PrismaCompanyConfigAdapter.name);

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly configService: ConfigService,
  ) {}

  public async getCompanyConfig(companyId = DEFAULT_COMPANY_ID): Promise<CompanyConfig> {
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

    this.logger.warn(`no company config row for ${companyId}; using defaults`);
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
