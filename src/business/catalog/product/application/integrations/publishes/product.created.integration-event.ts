import { ProductId } from '../../../domain/value-objects/product-id.vo';

export class ProductCreatedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'product.created',
    public occurredAt: string,
    public readonly productId: ProductId,
    public readonly sku: string,
    public readonly name: string,
    public readonly unitPrice: number,
    public readonly currency: string,
  ) {}
}
