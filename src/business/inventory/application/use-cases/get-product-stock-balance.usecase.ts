import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { StockMovementQuery } from '../../application/queries/stock-movement.query';

@Injectable()
export class GetProductStockBalanceUseCase {
  constructor(
    private readonly stockMovementQuery: StockMovementQuery,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(productId: string): Promise<{ productId: string; quantity: number } | null> {
    const ctx = this.requestContext.require();
    return this.stockMovementQuery.findBalance(productId, ctx.companyId, ctx.tenantId ?? undefined);
  }
}
