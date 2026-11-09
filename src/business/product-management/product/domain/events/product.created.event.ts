import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductId } from '../value-objects/product-id.vo';

export class ProductCreated extends DomainEvent {
  constructor(
    public readonly productId: ProductId,
    public readonly sku: string,
    public readonly name: string,
    public readonly unitPrice: Money,
    public readonly currency: string,
  ) {
    super();
  }
}
