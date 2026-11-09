import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export class StockBalanceUpdated extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly companyId: string,
    public readonly tenantId: string | null,
    public readonly previousQuantity: number,
    public readonly newQuantity: number,
  ) {
    super();
  }
}
