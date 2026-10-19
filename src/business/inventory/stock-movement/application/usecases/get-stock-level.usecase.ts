import { Injectable } from '@nestjs/common';
import { PrismaReadPort } from '@platform/context/ports/prisma-read.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';

/**
 * Read the stock-balance projection for one product inside a company
 * (plan Phase 5.4 consumer support). Reads go through `PrismaReadPort`
 * (replica); a missing balance means "never moved" → 0, and the tenant is
 * taken from the request context so one company's stock never leaks into
 * another tenant's view.
 */
@Injectable()
export class GetStockLevelUseCase {
  constructor(
    private readonly prismaRead: PrismaReadPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(productId: string, companyId: string): Promise<number> {
    const tenantId = this.requestContext.getTenantId();
    const balance = await this.prismaRead.stockBalance.findFirst({
      where: {
        productId,
        companyId,
        ...(tenantId ? { tenantId } : {}),
      },
    });
    return balance?.quantity ?? 0;
  }
}
