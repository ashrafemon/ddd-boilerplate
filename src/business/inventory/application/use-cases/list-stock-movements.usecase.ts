import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { StockMovementQuery } from '../../application/queries/stock-movement.query';
import { normalizePageQuery } from '@common/application/types/pagination';

interface ListStockMovementsQuery {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ListStockMovementsUseCase {
  constructor(
    private readonly stockMovementQuery: StockMovementQuery,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(
    productId: string,
    query?: ListStockMovementsQuery,
  ): Promise<{
    items: Array<{
      id: string;
      grnLineId: string;
      productId: string;
      quantity: number;
      movementType: string;
      sourceDocumentId: string;
      sourceDocumentType: string;
      companyId: string;
      tenantId: string | null;
      actorId: string | null;
      effectiveDate: Date;
      reversalOfId: string | null;
      createdAt: Date;
    }>;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    const ctx = this.requestContext.require();
    const pageQuery = normalizePageQuery(query);
    return this.stockMovementQuery.findByProduct(
      productId,
      ctx.companyId,
      ctx.tenantId ?? undefined,
      pageQuery,
    );
  }
}
