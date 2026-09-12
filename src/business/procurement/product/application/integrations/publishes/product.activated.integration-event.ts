import { ProductId } from '../../../domain/value-objects/product-id.vo';

export class ProductActivatedIntegrationEvent {
  constructor(public readonly productId: ProductId) {}
}
