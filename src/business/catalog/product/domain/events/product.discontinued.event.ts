import { DomainEvent } from '@business/shared-business';
import { ProductId } from '../value-objects';

export class ProductDiscontinued extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}
