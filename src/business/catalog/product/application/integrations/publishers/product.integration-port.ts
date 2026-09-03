import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export abstract class ProductIntegrationPort {
  abstract send(event: DomainEvent, productId: string): Promise<void>;
}
