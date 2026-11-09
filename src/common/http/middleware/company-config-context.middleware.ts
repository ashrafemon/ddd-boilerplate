import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { CompanyConfigPort } from '@platform/platform-organization/configuration/ports/company-config.port';

@Injectable()
export class CompanyConfigContextMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContext: RequestContextPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const companyId = (req.headers['x-company-id'] as string) ?? undefined;
    if (!companyId) {
      next();
      return;
    }

    try {
      const company = await this.companyConfig.getCompanyConfig(companyId);
      this.requestContext.set({
        defaultCurrency: company.defaultCurrency,
        autoApproveThreshold: company.autoApproveThreshold,
        overReceiptTolerance: company.overReceiptTolerance,
      });
    } catch {
      // Fail-closed: if company config cannot be resolved, leave the context
      // without company config fields so downstream ABAC/usecase logic can
      // detect the missing config.
    }

    next();
  }
}
