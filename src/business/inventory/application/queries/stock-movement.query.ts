import { StockMovementQueryRecord } from '../../domain/types/stock-movement.types';
import { PageQuery, PageResult } from '@common/application/types/pagination';

export abstract class StockMovementQuery {
  abstract findById(id: string): Promise<StockMovementQueryRecord | null>;
  abstract findByProduct(
    productId: string,
    companyId?: string,
    tenantId?: string,
    query?: PageQuery,
  ): Promise<PageResult<StockMovementQueryRecord>>;
  abstract findBalance(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<{ productId: string; quantity: number } | null>;
}
