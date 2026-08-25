import { DomainEvent, Money } from '@business/shared-business';
import { ProductId } from '../value-objects';

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
