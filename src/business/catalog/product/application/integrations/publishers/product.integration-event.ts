import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export abstract class ProductIntegrationEvet {
  abstract send(event: DomainEvent, aggregateType: string, aggregateId: string): Promise<void>;
}
