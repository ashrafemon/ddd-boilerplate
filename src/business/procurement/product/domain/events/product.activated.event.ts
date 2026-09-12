import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { ProductId } from '../value-objects/product-id.vo';

export class ProductActivated extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}
