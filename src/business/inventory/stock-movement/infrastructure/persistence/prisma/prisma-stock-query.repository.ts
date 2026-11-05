import { Injectable } from '@nestjs/common';
import { PrismaReadPort } from '@platform/context/ports/prisma-read.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { StockQuery } from '../../application/queries/stock.query';

/**
 * Prisma implementation of the stock-movement query port.
 *
 * Reads the `stock_balances` projection from the replica and scopes it to
 * the ambient tenant plus the requested company, so one company's stock
 * never leaks into another tenant's view.
 */
@Injectable()
export class PrismaStockQueryRepository extends StockQuery {
  constructor(
    private readonly prismaRead: PrismaReadPort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  async findBalance(productId: string, companyId: string): Promise<number | null> {
    const tenantId = this.requestContext.getTenantId();
    const balance = await this.prismaRead.stockBalance.findFirst({
      where: {
        productId,
        companyId,
        ...(tenantId ? { tenantId } : {}),
      },
    });
    return balance?.quantity ?? null;
  }
}
