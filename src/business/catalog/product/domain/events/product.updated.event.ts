import { DomainEvent } from '@business/shared-business';
import { ProductId } from '../value-objects';

export class ProductUpdated extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}
