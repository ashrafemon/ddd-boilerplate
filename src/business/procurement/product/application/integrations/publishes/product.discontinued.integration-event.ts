import { ProductId } from '../../../domain/value-objects/product-id.vo';

export class ProductDiscontinuedIntegrationEvent {
  constructor(public readonly productId: ProductId) {}
}
