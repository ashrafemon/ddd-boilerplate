import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { CompanyConfig, CompanyConfigPort, DEFAULT_COMPANY_ID } from '../ports/company-config.port';

/**
 * Prisma-backed company configuration adapter. Reads the configured company
 * through the TransactionHost so the lookup participates in the caller's
 * transaction.
 *
 * Company resolution: an explicit `companyId` argument wins; otherwise the
 * authenticated request context's organization is used (`x-organization-id`/
 * JWT claim), falling back to DEFAULT_COMPANY_ID for unscoped callers
 * (single-company deployments). In multi-tenancy mode a missing row for a
 * context-resolved company is a hard error — silent defaults must not bill
 * one tenant in another company's currency.
 */
@Injectable()
export class PrismaCompanyConfigRepository implements CompanyConfigPort {
  private readonly logger = new Logger(PrismaCompanyConfigRepository.name);

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly configService: ConfigService,
    private readonly requestContext: RequestContextPort,
  ) {}

  public async getCompanyConfig(companyId?: string): Promise<CompanyConfig> {
    const contextCompanyId = this.requestContext.get()?.organizationId;
    const resolved = companyId ?? contextCompanyId ?? DEFAULT_COMPANY_ID;

    const row = await this.txHost.tx.companyConfig.findUnique({
      where: { companyId: resolved },
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

    const explicitCompany = companyId !== undefined || contextCompanyId !== undefined;
    if (explicitCompany && this.configService.getSecurity().tenancy.mode === 'multi') {
      throw new NotFoundException(`Company configuration '${resolved}' not found`);
    }

    this.logger.warn(`no company config row for ${resolved}; using defaults`);
    return this.defaultConfig(resolved);
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
