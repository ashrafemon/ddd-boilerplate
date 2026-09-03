import { DomainEvent } from '@business/shared-business';

export abstract class ProductIntegrationPort {
  abstract send(event: DomainEvent, productId: string): Promise<void>;
}
