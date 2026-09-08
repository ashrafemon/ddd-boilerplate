import { ProductId } from '../../../domain/value-objects/product-id.vo';

export class ProductDeactivatedIntegrationEvent {
  constructor(public readonly productId: ProductId) {}
}
