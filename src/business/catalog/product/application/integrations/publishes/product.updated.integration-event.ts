import { ProductId } from '../../../domain/value-objects/product-id.vo';

export class ProductUpdatedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'product.updated',
    public occurredAt: string,
    public readonly productId: ProductId,
    public readonly name: string,
    public readonly description: string | null,
  ) {}
}
